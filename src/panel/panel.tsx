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
import { describeTerritory, otherPolitiesAtSpot } from './model.ts';
import type { CurrentEntry, PolityFile, SourceLine, SourcesFile, TerritoryView } from './model.ts';
import { attachSheetHandle } from './sheet.ts';
import type { SheetHeight } from './sheet.ts';

// --- Components ----------------------------------------------------------------------------------

function Sources({ lines }: { lines: SourceLine[] }) {
  return (
    <p class="panel-source">
      {t('panel.sourceLabel')}{' '}
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && '; '}
          {line.url ? (
            <a href={line.url} target="_blank" rel="noopener">
              {line.text}
            </a>
          ) : (
            line.text
          )}
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
  onGoToDay: (day: number) => void;
  onSelectOther: (polity: string) => void;
}

function Territory({ view, alsoHere, onGoToDay, onSelectOther }: TerritoryProps) {
  return (
    <>
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
        {view.missing && <p class="panel-missing">{view.missing}</p>}
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
    </>
  );
}

// --- The panel on the page -----------------------------------------------------------------------

export interface PanelOptions {
  /** Called when the reader closes the panel, or when the selected ID isn't in our data. */
  onClose: () => void;
  /** Called when the reader asks to see a record on the map (moves the timeline to `day`). */
  onGoToDay: (day: number) => void;
  /** Called when the reader picks another polity recorded at the spot they clicked. */
  onSelectOther: (polity: string) => void;
}

type FileState = PolityFile | 'loading' | 'failed';

/** Puts the panel on the page, loads polity files, and redraws when anything changes. */
export class TerritoryPanel {
  private readonly container: HTMLElement;
  private readonly options: PanelOptions;
  private sources: SourcesFile['sources'] | null = null;
  private readonly files = new Map<string, FileState>();
  private polity: string | null = null;
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
   * Shows a polity (by ID), or closes the panel (null). With `focus`, keyboard focus moves to the
   * panel's heading, so keyboard and screen-reader users land on what they just opened.
   */
  select(polity: string | null, focus = false): void {
    if (polity !== this.polity) {
      this.container.scrollTop = 0;
      if (this.polity === null) {
        this.sheet = 'half'; // opening from closed starts at half height
        this.container.dataset.sheet = this.sheet;
      }
    }
    this.polity = polity;
    this.focusPending = focus && polity !== null;
    if (polity && (!this.files.has(polity) || this.files.get(polity) === 'failed')) this.load(polity);
    this.draw();
  }

  setDay(day: number): void {
    this.day = day;
    this.draw();
  }

  /** Records which polities are at the spot the reader clicked, so the panel can offer the others. */
  setSpot(polities: string[]): void {
    this.spot = polities;
    for (const id of polities) if (!this.files.has(id)) this.load(id); // for their names
  }

  /** Whether keyboard focus is inside the panel (so closing it should move focus elsewhere). */
  hasFocus(): boolean {
    return this.container.contains(document.activeElement);
  }

  private load(id: string): void {
    this.files.set(id, 'loading');
    fetch(dataUrl(`polities/${id}.json`))
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        try {
          return (await response.json()) as PolityFile;
        } catch {
          return null; // not JSON: some servers answer a missing file with an HTML page
        }
      })
      .then((file) => {
        if (file && file.id === id) {
          this.files.set(id, file);
          this.draw();
          return;
        }
        // Not in our data (for example a mistyped link): close, as if the link had no selection.
        this.files.delete(id);
        if (this.polity === id) {
          this.polity = null;
          this.draw();
          this.options.onClose();
        }
      })
      .catch((error) => {
        console.error(`Could not load the details for ${id}`, error);
        this.files.set(id, 'failed'); // selecting it again retries
        this.draw();
      });
  }

  private draw(): void {
    if (!this.polity) return this.hide();
    const state = this.files.get(this.polity);
    const shell = { sheet: this.sheet, onClose: this.options.onClose };

    if (state === undefined || state === 'loading' || !this.sources) {
      this.show(`loading ${this.sheet}`, <Shell title={t('panel.loading')} {...shell}>{null}</Shell>);
    } else if (state === 'failed') {
      this.show(
        `failed ${this.sheet}`,
        <Shell title={t('panel.loadFailedTitle')} {...shell}>
          <p class="panel-empty">{t('panel.loadFailed')}</p>
        </Shell>,
      );
    } else {
      const view = describeTerritory(state, this.sources, this.day, getLocale());
      const namesOf = (id: string) => {
        const file = this.files.get(id);
        return typeof file === 'object' ? file.names : undefined;
      };
      const alsoHere = otherPolitiesAtSpot(this.spot, this.polity, namesOf, this.day, getLocale());
      this.show(
        `${this.sheet} ${JSON.stringify(alsoHere)} ${JSON.stringify(view)}`,
        <Shell title={view.name} subtitle={view.localName} summary={view.summary} {...shell}>
          <Territory view={view} alsoHere={alsoHere} onGoToDay={this.options.onGoToDay} onSelectOther={this.options.onSelectOther} />
        </Shell>,
      );
    }
    if (this.focusPending) {
      this.focusPending = false;
      this.container.querySelector<HTMLElement>('#panel-title')?.focus({ preventScroll: true });
    }
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
