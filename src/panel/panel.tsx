// The territory panel, built with Preact.
//
// How Preact works here: a component is a function that returns what the panel should look like,
// written in JSX (HTML-like tags inside TypeScript). Calling `render()` again with new data makes
// Preact update only the parts of the page that changed, so there's no hand-written "find this
// element and change its text" code. JSX always inserts values as text, never as HTML, so names
// from outside data can't inject markup.
//
// The components below only lay out a TerritoryView; what it says is worked out in model.ts.
// The TerritoryPanel class at the bottom is the plain-TypeScript side: main.ts tells it what's
// selected and which day it is, and it redraws.

// Preact's own files carry no license comment, so its MIT notice is repeated here. Comments
// starting with /*! are kept in the published code (see vite.config.ts), as the license requires.

/*! Preact (https://preactjs.com/) is bundled into this site under the MIT License:

The MIT License (MIT)

Copyright (c) 2015-present Jason Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { Fragment, render } from 'preact';
import type { ComponentChildren } from 'preact';
import { getLocale, t } from '../i18n/index.ts';
import { dataUrl } from '../map/historical.ts';
import { borderReportUrl } from '../url/report.ts';
import type { TimelineEvent } from '../timeline/events.ts';
import { describeEvent, describeNearby, describeTerritory, otherPolitiesAtSpot } from './model.ts';
import type { BorderChange, Credit, CurrentEntry, EventFile, EventView, NearbyView, PolityFile, SourceLine, SourcesFile, TerritoryView } from './model.ts';
import { attachSheetHandle } from './sheet.ts';
import type { SheetHeight } from './sheet.ts';

// --- Components ----------------------------------------------------------------------------------

function Sources({ lines }: { lines: SourceLine[] }) {
  const label = t(lines.length > 1 ? 'panel.sourcesLabel' : 'panel.sourceLabel');
  const cited = (line: SourceLine) =>
    line.url ? (
      <a href={line.url} target="_blank" rel="noopener">
        {line.text}
      </a>
    ) : (
      line.text
    );
  // Notes say who is speaking in each source (a consul's report, a government's statement), so
  // sources with notes get a line each.
  if (lines.some((line) => line.note)) {
    return (
      <div class="panel-source">
        <p>{label}</p>
        <ul class="panel-source-list">
          {lines.map((line, i) => (
            <li key={i}>
              {cited(line)}
              {line.note && `. ${line.note}`}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <p class="panel-source">
      {label}{' '}
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && '; '}
          {cited(line)}
        </Fragment>
      ))}
    </p>
  );
}

interface ShellProps {
  title: string;
  subtitle?: string;
  /** Shown only at the phone panel's smallest height. */
  summary?: string;
  sheet: SheetHeight;
  onClose: () => void;
  children: ComponentChildren;
}

/** The sources shown in a view, with the credit and license notice each asks for. */
function Credits({ credits }: { credits: Credit[] }) {
  if (credits.length === 0) return null;
  return (
    <section class="panel-section panel-credits" aria-labelledby="panel-credits">
      <h3 id="panel-credits">{t('panel.credits')}</h3>
      <ul class="panel-plain-list">
        {credits.map((credit) => (
          <li key={credit.title}>
            {credit.url ? (
              <a href={credit.url} target="_blank" rel="noopener">
                {credit.title}
              </a>
            ) : (
              credit.title
            )}
            {credit.attribution && <span>: {credit.attribution}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Shell({ title, subtitle, summary, sheet, onClose, children }: ShellProps) {
  return (
    <>
      {/* The phone panel's resize handle (hidden on wider screens); see sheet.ts. */}
      <button type="button" class="panel-handle" aria-label={t('panel.resize', { size: t(`panel.size.${sheet}`) })}>
        <span aria-hidden="true" />
      </button>
      <header class="panel-header">
        <div>
          {/* tabIndex -1: not in the Tab order, but focus can be moved here when the panel opens. */}
          <h2 id="panel-title" tabIndex={-1}>
            {title}
          </h2>
          {subtitle && <p class="panel-local">{subtitle}</p>}
          {summary && <p class="panel-summary">{summary}</p>}
        </div>
        <button type="button" class="panel-close" onClick={onClose} aria-label={t('panel.close')} title={t('panel.close')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
          </svg>
        </button>
      </header>
      {children}
    </>
  );
}

function Current({ entry }: { entry: CurrentEntry }) {
  return (
    <li class="panel-record">
      <p class="panel-relation">{entry.label}</p>
      <dl class="panel-dates">
        <dt>{t('panel.began')}</dt>
        <dd>{entry.began}</dd>
        <dt>{t('panel.ended')}</dt>
        <dd>{entry.ended}</dd>
      </dl>
      {entry.notes.map((note, i) => (
        <p key={i} class="panel-note">
          {note}
        </p>
      ))}
      <Sources lines={entry.sources} />
    </li>
  );
}

interface TerritoryProps {
  view: TerritoryView;
  alsoHere: { id: string; name: string }[];
  /** The "Report a problem" address for the current view (built when used, so it's never stale). */
  reportUrl: () => string;
  onGoToDay: (day: number) => void;
  onSelectOther: (polity: string) => void;
}

function Territory({ view, alsoHere, reportUrl, onGoToDay, onSelectOther }: TerritoryProps) {
  // Refresh the link just before it's used: the map may have moved since the panel was drawn.
  const refreshReportLink = (event: Event) => ((event.currentTarget as HTMLAnchorElement).href = reportUrl());
  return (
    <>
      {view.note && <p class="panel-note">{view.note}</p>}
      {alsoHere.length > 0 && (
        <p class="panel-also">
          {t('panel.alsoHere')}{' '}
          {alsoHere.map((other, i) => (
            <Fragment key={other.id}>
              {i > 0 && ', '}
              <button type="button" class="panel-link-button" onClick={() => onSelectOther(other.id)}>
                {other.name}
              </button>
            </Fragment>
          ))}
        </p>
      )}

      <section class="panel-section" aria-labelledby="panel-now">
        <h3 id="panel-now">{t('panel.onThisDate')}</h3>
        {!view.hasTerritory && <p class="panel-empty">{t('panel.noTerritory', { name: view.name })}</p>}
        {view.current.length > 0 && (
          <ul class="panel-records">
            {view.current.map((entry) => (
              <Current key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
        {view.figures.length > 0 && (
          <div class="panel-figures">
            <h4>{t('panel.figures')}</h4>
            <ul class="panel-plain-list">
              {view.figures.map((figure) => (
                <li key={figure.id} class="panel-figure">
                  <p>
                    <span class="panel-figure-label">{figure.label}:</span> {figure.value}
                  </p>
                  {figure.notes.map((note, i) => (
                    <p key={i} class="panel-note">
                      {note}
                    </p>
                  ))}
                  <Sources lines={figure.sources} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {view.contested.map((line, i) => (
          <p key={i} class="panel-contested">
            <span class="panel-contested-swatch" aria-hidden="true" />
            {line}
          </p>
        ))}
        {view.missing && <p class="panel-missing">{view.missing}</p>}
        {view.smallTerritory && <p class="panel-missing">{view.smallTerritory}</p>}
        <p class="panel-report">
          <a href={reportUrl()} target="_blank" rel="noopener" onPointerDown={refreshReportLink} onFocus={refreshReportLink}>
            {t('panel.report')}
          </a>{' '}
          <span class="panel-report-note">{t('panel.reportNote')}</span>
        </p>
      </section>

      {view.history.length > 0 && (
        <details class="panel-section">
          <summary>{t('panel.history', { count: view.history.length })}</summary>
          <ol class="panel-history">
            {view.history.map((entry) => (
              <li key={entry.id} class={entry.current ? 'is-current' : undefined}>
                <p class="panel-relation">{entry.label}</p>
                <p>
                  {entry.period}
                  {entry.current && <strong class="panel-current-tag"> · {t('panel.inEffect')}</strong>}
                </p>
                <Sources lines={entry.sources} />
                <button type="button" class="panel-goto" onClick={() => onGoToDay(entry.day)}>
                  {t('panel.goTo')}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}

      <details class="panel-section">
        <summary>{t('panel.names', { count: view.nameCount })}</summary>
        {view.names.map((group, i) => (
          <div key={i} class="panel-name-group">
            <ul class="panel-names">
              {group.names.map((name, j) => (
                <li key={j}>
                  <span class="panel-name" lang={name.lang}>
                    {name.text}
                  </span>{' '}
                  <span class="panel-name-language">{name.language}</span>
                  {name.period && <span class="panel-name-period">{name.period}</span>}
                </li>
              ))}
            </ul>
            <Sources lines={group.sources} />
          </div>
        ))}
      </details>
      <Credits credits={view.credits} />
    </>
  );
}

interface EventDetailsProps {
  view: EventView;
  onSelectPolity: (polity: string) => void;
}

function EventDetails({ view, onSelectPolity }: EventDetailsProps) {
  return (
    <>
      <section class="panel-section" aria-labelledby="panel-event-date">
        <h3 id="panel-event-date">{t('panel.date')}</h3>
        <p>{view.date}</p>
        <p class="panel-event-summary">{view.summary}</p>
        <p class="panel-note">{t('panel.summaryNote')}</p>
        <Sources lines={view.sources} />
        {view.location && (
          <>
            <p>{view.location.text}</p>
            <Sources lines={view.location.sources} />
          </>
        )}
      </section>

      {view.polities.length > 0 && (
        <section class="panel-section" aria-labelledby="panel-event-polities">
          <h3 id="panel-event-polities">{t('panel.eventPolities')}</h3>
          <ul class="panel-plain-list">
            {view.polities.map((polity) => (
              <li key={polity.id}>
                <button type="button" class="panel-link-button" onClick={() => onSelectPolity(polity.id)}>
                  {polity.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.effects.length > 0 && (
        <section class="panel-section" aria-labelledby="panel-event-effects">
          <h3 id="panel-event-effects">{t('panel.effects')}</h3>
          <p class="panel-note">{t('panel.effectsNote')}</p>
          <ul class="panel-records">
            {view.effects.map((effect) => (
              <li key={effect.id} class="panel-record">
                <p class="panel-relation">{effect.label}</p>
                <p>{effect.period}</p>
                <Sources lines={effect.sources} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <Credits credits={view.credits} />
    </>
  );
}

interface NearbyProps {
  view: NearbyView;
  onSelectEvent: (id: string) => void;
  onSelectPolity: (polity: string) => void;
  onGoToDay: (day: number) => void;
}

function Nearby({ view, onSelectEvent, onSelectPolity, onGoToDay }: NearbyProps) {
  return (
    <>
      <p class="panel-note">{view.window}</p>
      <section class="panel-section" aria-labelledby="nearby-events">
        <h3 id="nearby-events">{t('nearby.events')}</h3>
        {view.events.length > 0 ? (
          <ul class="panel-plain-list">
            {view.events.map((event) => (
              <li key={event.id}>
                <button type="button" class="panel-link-button" onClick={() => onSelectEvent(event.id)}>
                  {event.title}
                </button>{' '}
                <span class="panel-name-period">{event.date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="panel-empty">{t('nearby.noEvents')}</p>
        )}
      </section>
      <section class="panel-section" aria-labelledby="nearby-changes">
        <h3 id="nearby-changes">{t('nearby.changes')}</h3>
        {view.changes.length > 0 ? (
          <ul class="panel-records">
            {view.changes.map((change) => (
              <li key={change.key} class="panel-record">
                <button type="button" class="panel-link-button" onClick={() => onSelectPolity(change.polity)}>
                  {change.name}
                </button>
                <p class="panel-relation">{change.label}</p>
                <button type="button" class="panel-goto" onClick={() => onGoToDay(change.day)}>
                  {t('nearby.goTo', { date: change.date })}
                </button>
                <Sources lines={change.sources} />
              </li>
            ))}
          </ul>
        ) : (
          <p class="panel-empty">{t('nearby.noChanges')}</p>
        )}
      </section>
      <Credits credits={view.credits} />
    </>
  );
}

// --- The panel on the page -----------------------------------------------------------------------

/**
 * What the panel shows: a territory (by polity ID), an event (by event ID), or what changed
 * around the selected date ('nearby', which has no ID).
 */
export interface Selection {
  kind: 'polity' | 'event' | 'nearby';
  id: string;
}

export interface PanelOptions {
  /** Called when the reader closes the panel, or when the selected ID isn't in our data. */
  onClose: () => void;
  /** Called when the reader asks to see a record on the map (moves the timeline to `day`). */
  onGoToDay: (day: number) => void;
  /** Called when the reader picks a territory in the panel (at the clicked spot, or in an event). */
  onSelectPolity: (polity: string) => void;
  /** Called once each time an event's details appear, for the map's outlines and pulse. */
  onEventShown: (file: EventFile) => void;
  /** The full shareable link to the current view (for "Report a problem"). */
  viewLink: () => string;
  /** Called when the reader picks an event in the panel. */
  onSelectEvent: (id: string) => void;
  /** The days at the timeline's left and right edges (the "around this date" window). */
  visibleRange: () => [number, number];
}

type FileState = PolityFile | EventFile | 'loading' | 'failed';

/** Where a selection's file is, under public/data/ (without ".json"). */
const pathOf = (selection: Selection) => `${selection.kind === 'polity' ? 'polities' : 'events'}/${selection.id}`;

/** Puts the panel on the page, loads the files it needs, and redraws when anything changes. */
export class TerritoryPanel {
  private readonly container: HTMLElement;
  private readonly options: PanelOptions;
  private sources: SourcesFile['sources'] | null = null;
  /** public/data/changes.json, loaded the first time "around this date" opens. */
  private changes: BorderChange[] | 'loading' | null = null;
  /** The timeline's events (from main.ts), for "around this date". */
  private events: TimelineEvent[] = [];
  /** Loaded files by path (see pathOf). */
  private readonly files = new Map<string, FileState>();
  private selection: Selection | null = null;
  /** The event whose details were last reported with onEventShown. */
  private shownEvent: string | null = null;
  /** The polities recorded where the reader last clicked, top one first. */
  private spot: string[] = [];
  private day: number;
  /** The phone panel's height (see sheet.ts). */
  private sheet: SheetHeight = 'half';
  /** Move keyboard focus to the heading after the next draw. */
  private focusPending = false;
  /** What was last drawn, to skip redrawing when nothing changed (e.g. during playback). */
  private drawn = '';

  constructor(container: HTMLElement, initialDay: number, options: PanelOptions) {
    this.container = container;
    this.day = initialDay;
    this.options = options;
    this.container.dataset.sheet = this.sheet;
    attachSheetHandle(
      container,
      () => this.sheet,
      (height) => {
        this.sheet = height;
        this.container.dataset.sheet = height;
        this.draw();
      },
    );
    fetch(dataUrl('sources.json'))
      .then((r) => r.json() as Promise<SourcesFile>)
      .then((file) => {
        this.sources = file.sources;
        this.draw();
      })
      .catch((error) => console.error('Could not load sources.json', error));
  }

  /**
   * Shows a territory or an event, or closes the panel (null). With `focus`, keyboard focus moves
   * to the panel's heading, so keyboard and screen-reader users land on what they just opened.
   */
  select(selection: Selection | null, focus = false): void {
    const changed = (selection && pathOf(selection)) !== (this.selection && pathOf(this.selection));
    if (changed) {
      this.container.scrollTop = 0;
      this.shownEvent = null;
      if (this.selection === null) {
        this.sheet = 'half'; // opening from closed starts at half height
        this.container.dataset.sheet = this.sheet;
      }
    }
    this.selection = selection;
    this.focusPending = focus && selection !== null;
    if (selection?.kind === 'nearby') this.loadChanges();
    else if (selection) this.loadIfNeeded(pathOf(selection));
    this.draw();
  }

  /** The timeline's events, for "around this date". */
  setEvents(events: TimelineEvent[]): void {
    this.events = events;
    this.draw();
  }

  /** Redraws, for example when the timeline zooms (which changes the "around this date" window). */
  refresh(): void {
    this.draw();
  }

  private loadChanges(): void {
    if (this.changes !== null) return;
    this.changes = 'loading';
    fetch(dataUrl('changes.json'))
      .then((r) => r.json() as Promise<{ changes: BorderChange[] }>)
      .then((file) => {
        this.changes = file.changes;
        this.draw();
      })
      .catch((error) => {
        console.error('Could not load changes.json', error);
        this.changes = null; // opening it again retries
      });
  }

  setDay(day: number): void {
    this.day = day;
    this.draw();
  }

  /** Records which polities are at the spot the reader clicked, so the panel can offer the others. */
  setSpot(polities: string[]): void {
    this.spot = polities;
    for (const id of polities) this.loadIfNeeded(`polities/${id}`); // for their names
  }

  /** Whether keyboard focus is inside the panel (so closing it should move focus elsewhere). */
  hasFocus(): boolean {
    return this.container.contains(document.activeElement);
  }

  private loadIfNeeded(path: string): void {
    const state = this.files.get(path);
    if (state === undefined || state === 'failed') this.load(path); // a failed load is retried
  }

  private load(path: string): void {
    this.files.set(path, 'loading');
    const id = path.slice(path.indexOf('/') + 1);
    fetch(dataUrl(`${path}.json`))
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        try {
          return (await response.json()) as PolityFile | EventFile;
        } catch {
          return null; // not JSON: some servers answer a missing file with an HTML page
        }
      })
      .then((file) => {
        if (file && file.id === id) {
          this.files.set(path, file);
          this.draw();
          return;
        }
        // Not in our data (for example a mistyped link): close, as if the link had no selection.
        this.files.delete(path);
        if (this.selection && pathOf(this.selection) === path) {
          this.selection = null;
          this.draw();
          this.options.onClose();
        }
      })
      .catch((error) => {
        console.error(`Could not load ${path}`, error);
        this.files.set(path, 'failed');
        this.draw();
      });
  }

  private draw(): void {
    const selection = this.selection;
    if (!selection) return this.hide();
    const shell = { sheet: this.sheet, onClose: this.options.onClose };
    const locale = getLocale();
    const polityNames = (id: string) => {
      const file = this.files.get(`polities/${id}`);
      return typeof file === 'object' ? (file as PolityFile).names : undefined;
    };

    if (selection.kind === 'nearby') {
      if (!Array.isArray(this.changes) || !this.sources) {
        this.show(`loading ${this.sheet}`, <Shell title={t('panel.loading')} {...shell}>{null}</Shell>);
      } else {
        const view = describeNearby(this.day, this.options.visibleRange(), this.events, this.changes, this.sources, polityNames, locale);
        for (const change of view.changes) this.loadIfNeeded(`polities/${change.polity}`); // for their names
        this.show(
          `${this.sheet} ${JSON.stringify(view)}`,
          <Shell title={view.title} summary={view.window} {...shell}>
            <Nearby
              view={view}
              onSelectEvent={this.options.onSelectEvent}
              onSelectPolity={this.options.onSelectPolity}
              onGoToDay={this.options.onGoToDay}
            />
          </Shell>,
        );
      }
      return this.focusIfPending();
    }

    const state = this.files.get(pathOf(selection));
    if (state === undefined || state === 'loading' || !this.sources) {
      this.show(`loading ${this.sheet}`, <Shell title={t('panel.loading')} {...shell}>{null}</Shell>);
    } else if (state === 'failed') {
      this.show(
        `failed ${this.sheet}`,
        <Shell title={t('panel.loadFailedTitle')} {...shell}>
          <p class="panel-empty">{t('panel.loadFailed')}</p>
        </Shell>,
      );
    } else if (selection.kind === 'event') {
      const file = state as EventFile;
      const view = describeEvent(file, this.sources, this.day, locale);
      this.show(
        `${this.sheet} ${JSON.stringify(view)}`,
        <Shell title={view.title} subtitle={t('panel.eventLabel')} summary={view.date} {...shell}>
          <EventDetails view={view} onSelectPolity={this.options.onSelectPolity} />
        </Shell>,
      );
      if (this.shownEvent !== file.id) {
        this.shownEvent = file.id;
        this.options.onEventShown(file);
      }
    } else {
      const polity = selection.id;
      const view = describeTerritory(state as PolityFile, this.sources, this.day, locale);
      const alsoHere = otherPolitiesAtSpot(this.spot, polity, polityNames, this.day, locale);
      const reportUrl = () => borderReportUrl({ name: view.name, polity, day: this.day, viewLink: this.options.viewLink() });
      this.show(
        `${this.sheet} ${JSON.stringify(alsoHere)} ${JSON.stringify(view)}`,
        <Shell title={view.name} subtitle={view.localName} summary={view.summary} {...shell}>
          <Territory
            view={view}
            alsoHere={alsoHere}
            reportUrl={reportUrl}
            onGoToDay={this.options.onGoToDay}
            onSelectOther={this.options.onSelectPolity}
          />
        </Shell>,
      );
    }
    this.focusIfPending();
  }

  private focusIfPending(): void {
    if (!this.focusPending) return;
    this.focusPending = false;
    this.container.querySelector<HTMLElement>('#panel-title')?.focus({ preventScroll: true });
  }

  private show(key: string, content: preact.JSX.Element): void {
    if (key === this.drawn) return;
    this.drawn = key;
    this.container.hidden = false;
    render(content, this.container);
  }

  private hide(): void {
    if (this.container.hidden) return;
    this.container.hidden = true;
    this.drawn = '';
    render(null, this.container);
  }
}
