// The timeline bar: a fixed playhead in the middle marks the selected date, and time slides
// beneath it. Drag to move through time, scroll or pinch to zoom (zooming always keeps the
// selected date under the playhead), click to jump, or press play.
//
// It's drawn on a <canvas> for smooth redrawing while dragging. For keyboard and screen-reader
// users, the track is an ARIA slider whose value text is the selected date.

import { formatDay, formatYear, monthShortName } from '../dates/index.ts';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { chooseTickUnit, clamp, generateTicks, stepDay } from './scale.ts';
import type { Tick, TickUnit } from './scale.ts';
import './timeline.css';

export interface TimelineOptions {
  container: HTMLElement;
  /** First and last selectable days (Julian Day Numbers, inclusive). */
  minJdn: number;
  maxJdn: number;
  /** Day selected when the page opens. */
  initialJdn: number;
  /** How many days are visible across the bar when the page opens. */
  initialSpanDays: number;
  /** Called whenever the selected day changes. */
  onChange?: (jdn: number) => void;
}

const DAYS_PER_YEAR = 365.2425;
const SPEEDS: { label: MessageKey; daysPerSecond: number }[] = [
  { label: 'timeline.speed.day', daysPerSecond: 1 },
  { label: 'timeline.speed.week', daysPerSecond: 7 },
  { label: 'timeline.speed.month', daysPerSecond: DAYS_PER_YEAR / 12 },
  { label: 'timeline.speed.year', daysPerSecond: DAYS_PER_YEAR },
  { label: 'timeline.speed.decade', daysPerSecond: DAYS_PER_YEAR * 10 },
  { label: 'timeline.speed.century', daysPerSecond: DAYS_PER_YEAR * 100 },
];
const DEFAULT_SPEED = 2; // 1 month per second

const MIN_TICK_SPACING_PX = 84; // room for a label like "10000 BCE"
// How far in you can zoom. Must exceed MIN_TICK_SPACING_PX so single days get their own ticks.
const MAX_PIXELS_PER_DAY = 100;
const ZOOM_FACTOR = 2; // per click of the zoom buttons or press of +/-
const CLICK_TOLERANCE_PX = 4; // a press that moves less than this is a click, not a drag

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  zoomIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"/></svg>',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

export class Timeline {
  private readonly options: TimelineOptions;
  /** Fractional day number under the playhead; the selected day is Math.floor(position). */
  private position: number;
  private daysPerPixel = 1;
  private width = 0;
  private height = 0;
  private sized = false;
  private lastReportedDay = Number.NaN;

  private playing = false;
  private speed = DEFAULT_SPEED;
  private lastFrameTime = 0;
  private frameRequested = false;

  /** Active pointers (mouse, fingers, pen) by id, with their last x position. */
  private readonly pointers = new Map<number, number>();
  private dragDistance = 0;
  private pinchDistance = 0;

  private readonly track: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly dateLabel: HTMLOutputElement;
  private readonly playButton: HTMLButtonElement;
  private colors = { tick: '', label: '', labelMajor: '', playhead: '', outside: '', font: '' };

  constructor(options: TimelineOptions) {
    this.options = options;
    this.position = options.initialJdn + 0.5;

    const root = element('div', 'timeline');

    const controls = element('div', 'timeline-controls');
    this.playButton = element('button', 'timeline-button timeline-play');
    this.playButton.type = 'button';
    this.playButton.addEventListener('click', () => this.togglePlay());

    this.dateLabel = element('output', 'timeline-date');

    const speedLabel = element('label', 'timeline-speed');
    const speedText = element('span', 'visually-hidden');
    speedText.textContent = t('timeline.speed');
    const speedSelect = element('select', 'timeline-speed-select');
    SPEEDS.forEach((s, i) => {
      const isDefault = i === DEFAULT_SPEED;
      speedSelect.add(new Option(t(s.label), String(i), isDefault, isDefault));
    });
    speedSelect.addEventListener('change', () => (this.speed = Number(speedSelect.value)));
    speedLabel.append(speedText, speedSelect);

    const zoomOut = this.iconButton(ICONS.zoomOut, t('timeline.zoomOut'), () => this.zoomBy(ZOOM_FACTOR));
    const zoomIn = this.iconButton(ICONS.zoomIn, t('timeline.zoomIn'), () => this.zoomBy(1 / ZOOM_FACTOR));
    const zoom = element('div', 'timeline-zoom');
    zoom.append(zoomOut, zoomIn);

    controls.append(this.playButton, this.dateLabel, speedLabel, zoom);

    const help = element('p', 'visually-hidden');
    help.id = 'timeline-help';
    help.textContent = t('timeline.help');

    this.track = element('div', 'timeline-track');
    this.track.tabIndex = 0;
    this.track.setAttribute('role', 'slider');
    this.track.setAttribute('aria-label', t('timeline.label'));
    this.track.setAttribute('aria-describedby', help.id);
    this.track.setAttribute('aria-valuemin', String(options.minJdn));
    this.track.setAttribute('aria-valuemax', String(options.maxJdn));

    this.canvas = element('canvas', 'timeline-canvas');
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot draw the timeline (no 2D canvas).');
    this.context = context;
    this.track.append(this.canvas);

    root.append(controls, this.track, help);
    options.container.append(root);

    this.updatePlayButton();
    this.bindPointerEvents();
    this.bindKeyboard();
    new ResizeObserver(() => this.resize()).observe(this.track);
    this.reportChange();
  }

  /** The selected day, as a Julian Day Number. */
  get day(): number {
    return Math.floor(this.position);
  }

  /** Moves the playhead to a day. */
  setDay(jdn: number): void {
    this.setPosition(jdn + 0.5);
  }

  // --- State changes ---------------------------------------------------------------------

  private setPosition(position: number): void {
    // Keep the playhead inside the selectable range (the end is exclusive, hence the epsilon).
    this.position = clamp(position, this.options.minJdn, this.options.maxJdn + 1 - 1e-6);
    this.reportChange();
    this.requestDraw();
  }

  private zoomBy(factor: number): void {
    this.daysPerPixel = clamp(this.daysPerPixel * factor, 1 / MAX_PIXELS_PER_DAY, this.maxDaysPerPixel());
    this.requestDraw();
  }

  /** Fully zoomed out, the whole selectable range fits in 80% of the bar. */
  private maxDaysPerPixel(): number {
    return (this.options.maxJdn - this.options.minJdn + 1) / Math.max(1, this.width * 0.8);
  }

  private reportChange(): void {
    const day = this.day;
    if (day === this.lastReportedDay) return;
    this.lastReportedDay = day;
    const text = formatDay(day);
    this.dateLabel.textContent = text;
    this.track.setAttribute('aria-valuenow', String(day));
    this.track.setAttribute('aria-valuetext', text);
    this.options.onChange?.(day);
  }

  private currentUnit(): TickUnit {
    return chooseTickUnit(this.daysPerPixel, MIN_TICK_SPACING_PX);
  }

  // --- Playback ----------------------------------------------------------------------------

  private togglePlay(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  private play(): void {
    if (this.day >= this.options.maxJdn) return; // already at the end
    this.playing = true;
    this.lastFrameTime = 0;
    this.updatePlayButton();
    this.requestDraw();
  }

  private pause(): void {
    this.playing = false;
    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    this.playButton.innerHTML = this.playing ? ICONS.pause : ICONS.play;
    this.playButton.setAttribute('aria-label', t(this.playing ? 'timeline.pause' : 'timeline.play'));
  }

  // --- Drawing -------------------------------------------------------------------------------

  private requestDraw(): void {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame((time) => this.frame(time));
  }

  private frame(time: number): void {
    this.frameRequested = false;
    if (this.playing) {
      if (this.lastFrameTime) {
        // Cap the step so a stalled tab doesn't jump years when it wakes up.
        const seconds = Math.min(time - this.lastFrameTime, 100) / 1000;
        this.setPosition(this.position + SPEEDS[this.speed].daysPerSecond * seconds);
        if (this.day >= this.options.maxJdn) this.pause();
      }
      this.lastFrameTime = time;
      if (this.playing) this.requestDraw();
    }
    this.draw();
  }

  private resize(): void {
    this.width = this.track.clientWidth;
    this.height = this.track.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    if (!this.sized && this.width > 0) {
      this.daysPerPixel = this.options.initialSpanDays / this.width;
      this.sized = true;
    }
    this.zoomBy(1); // re-apply zoom limits for the new width

    const style = getComputedStyle(this.track);
    this.colors = {
      tick: style.getPropertyValue('--timeline-tick'),
      label: style.getPropertyValue('--timeline-label'),
      labelMajor: style.getPropertyValue('--timeline-label-major'),
      playhead: style.getPropertyValue('--timeline-playhead'),
      outside: style.getPropertyValue('--timeline-outside'),
      font: style.fontFamily,
    };
    this.requestDraw();
  }

  /** Short labels under the ticks; the first of each larger unit is bold ("major"). */
  private tickLabel(tick: Tick): { text: string; major: boolean } {
    if (tick.kind === 'day') {
      if (tick.day !== 1) return { text: String(tick.day), major: false };
      const month = monthShortName(tick.month);
      return { text: t('date.monthYear', { month, year: formatYear(tick.year) }), major: true };
    }
    if (tick.kind === 'month') {
      if (tick.month !== 1) return { text: monthShortName(tick.month), major: false };
      return { text: formatYear(tick.year), major: true };
    }
    return { text: formatYear(tick.year), major: false };
  }

  private draw(): void {
    const { context: ctx, width, height, daysPerPixel, colors } = this;
    if (width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const left = this.position - (width / 2) * daysPerPixel;
    const right = this.position + (width / 2) * daysPerPixel;
    const x = (jdn: number) => (jdn - left) / daysPerPixel;
    const { minJdn, maxJdn } = this.options;

    // Shade the parts of the bar outside the selectable range.
    ctx.fillStyle = colors.outside;
    if (left < minJdn) ctx.fillRect(0, 0, x(minJdn), height);
    if (right > maxJdn + 1) ctx.fillRect(x(maxJdn + 1), 0, width - x(maxJdn + 1), height);

    // Ticks along the bottom edge, with labels above them.
    const baseline = height - 1;
    const ticks = generateTicks(this.currentUnit(), Math.max(left, minJdn), Math.min(right, maxJdn + 1));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const tick of ticks) {
      const tx = Math.round(x(tick.jdn)) + 0.5;
      const { text, major } = this.tickLabel(tick);
      ctx.strokeStyle = colors.tick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, baseline - (major ? 14 : 9));
      ctx.lineTo(tx, baseline);
      ctx.stroke();
      ctx.fillStyle = major ? colors.labelMajor : colors.label;
      ctx.font = `${major ? 600 : 400} 12px ${colors.font}`;
      ctx.fillText(text, tx, baseline - 18);
    }

    // The playhead: a line down the middle with a small marker at the top.
    const mid = Math.round(width / 2) + 0.5;
    ctx.strokeStyle = colors.playhead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mid, 0);
    ctx.lineTo(mid, height);
    ctx.stroke();
    ctx.fillStyle = colors.playhead;
    ctx.beginPath();
    ctx.moveTo(mid - 6, 0);
    ctx.lineTo(mid + 6, 0);
    ctx.lineTo(mid, 7);
    ctx.fill();
  }

  // --- Input ---------------------------------------------------------------------------------

  private iconButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = element('button', 'timeline-button');
    button.type = 'button';
    button.innerHTML = icon;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private pinchSpan(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.abs(a - b);
  }

  private bindPointerEvents(): void {
    const track = this.track;

    track.addEventListener('pointerdown', (event) => {
      track.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, event.clientX);
      if (this.pointers.size === 1) {
        this.dragDistance = 0;
        this.pause(); // grabbing the timeline stops playback
      } else if (this.pointers.size === 2) {
        this.pinchDistance = this.pinchSpan();
      }
    });

    track.addEventListener('pointermove', (event) => {
      const previousX = this.pointers.get(event.pointerId);
      if (previousX === undefined) return;
      this.pointers.set(event.pointerId, event.clientX);
      if (this.pointers.size === 1) {
        const dx = event.clientX - previousX;
        this.dragDistance += Math.abs(dx);
        this.setPosition(this.position - dx * this.daysPerPixel);
      } else if (this.pointers.size === 2) {
        const span = this.pinchSpan();
        if (this.pinchDistance > 0 && span > 0) this.zoomBy(this.pinchDistance / span);
        this.pinchDistance = span;
      }
    });

    const release = (event: PointerEvent) => {
      if (!this.pointers.has(event.pointerId)) return;
      const wasClick =
        event.type === 'pointerup' && this.pointers.size === 1 && this.dragDistance < CLICK_TOLERANCE_PX;
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (wasClick) {
        // Jump to the clicked date.
        const offset = event.clientX - track.getBoundingClientRect().left - this.width / 2;
        this.setPosition(this.position + offset * this.daysPerPixel);
      }
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    track.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault(); // keep the page from scrolling
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.width : 1;
        const dx = event.deltaX * unit;
        const dy = event.deltaY * unit;
        if (Math.abs(dx) > Math.abs(dy)) this.setPosition(this.position + dx * this.daysPerPixel);
        else this.zoomBy(Math.exp(dy * 0.002));
      },
      { passive: false },
    );
  }

  private bindKeyboard(): void {
    this.track.addEventListener('keydown', (event) => {
      const unit = this.currentUnit();
      const bigUnit = { ...unit, step: unit.step * 10 };
      const { minJdn, maxJdn } = this.options;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          this.setDay(stepDay(this.day, unit, 1));
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          this.setDay(stepDay(this.day, unit, -1));
          break;
        case 'PageUp':
          this.setDay(stepDay(this.day, bigUnit, 1));
          break;
        case 'PageDown':
          this.setDay(stepDay(this.day, bigUnit, -1));
          break;
        case 'Home':
          this.setDay(minJdn);
          break;
        case 'End':
          this.setDay(maxJdn);
          break;
        case '+':
        case '=':
          this.zoomBy(1 / ZOOM_FACTOR);
          break;
        case '-':
        case '_':
          this.zoomBy(ZOOM_FACTOR);
          break;
        case ' ':
          this.togglePlay();
          break;
        default:
          return; // let other keys through
      }
      event.preventDefault();
    });
  }
}
