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
import { describeTerritory } from './model.ts';
import type { CurrentEntry, PolityFile, SourceLine, SourcesFile, TerritoryView } from './model.ts';

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

function Shell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <>
      <header class="panel-header">
        <div>
          <h2 id="panel-title">{title}</h2>
          {subtitle && <p class="panel-local">{subtitle}</p>}
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

function Territory({ view, onGoToDay }: { view: TerritoryView; onGoToDay: (day: number) => void }) {
  return (
    <>
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
}

type FileState = PolityFile | 'loading' | 'failed';

/** Puts the panel on the page, loads polity files, and redraws when anything changes. */
export class TerritoryPanel {
  private readonly container: HTMLElement;
  private readonly options: PanelOptions;
  private sources: SourcesFile['sources'] | null = null;
  private readonly files = new Map<string, FileState>();
  private polity: string | null = null;
  private day: number;
  /** What was last drawn, to skip redrawing when nothing changed (e.g. during playback). */
  private drawn = '';

  constructor(container: HTMLElement, initialDay: number, options: PanelOptions) {
    this.container = container;
    this.day = initialDay;
    this.options = options;
    fetch(dataUrl('sources.json'))
      .then((r) => r.json() as Promise<SourcesFile>)
      .then((file) => {
        this.sources = file.sources;
        this.draw();
      })
      .catch((error) => console.error('Could not load sources.json', error));
  }

  /** Shows a polity (by ID), or closes the panel (null). */
  select(polity: string | null): void {
    if (polity !== this.polity) this.container.scrollTop = 0;
    this.polity = polity;
    if (polity && (!this.files.has(polity) || this.files.get(polity) === 'failed')) this.load(polity);
    this.draw();
  }

  setDay(day: number): void {
    this.day = day;
    this.draw();
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
    const onClose = this.options.onClose;

    if (state === undefined || state === 'loading' || !this.sources) {
      return this.show('loading', <Shell title={t('panel.loading')} onClose={onClose}>{null}</Shell>);
    }
    if (state === 'failed') {
      return this.show(
        'failed',
        <Shell title={t('panel.loadFailedTitle')} onClose={onClose}>
          <p class="panel-empty">{t('panel.loadFailed')}</p>
        </Shell>,
      );
    }
    const view = describeTerritory(state, this.sources, this.day, getLocale());
    this.show(
      JSON.stringify(view),
      <Shell title={view.name} subtitle={view.localName} onClose={onClose}>
        <Territory view={view} onGoToDay={this.options.onGoToDay} />
      </Shell>,
    );
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
