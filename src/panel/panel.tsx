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

import { render } from 'preact';
import { getLocale, t } from '../i18n/index.ts';
import { dataUrl } from '../map/historical.ts';
import type { BorderRecord } from '../map/historical.ts';
import { describeTerritory } from './model.ts';
import type { Atlas, BorderEntry, TerritoryView } from './model.ts';

function Border({ border }: { border: BorderEntry }) {
  return (
    <li class="panel-border">
      <p class="panel-relation">{border.relation}</p>
      <dl class="panel-dates">
        <dt>{t('panel.began')}</dt>
        <dd>{border.began}</dd>
        <dt>{t('panel.ended')}</dt>
        <dd>{border.ended}</dd>
      </dl>
      {border.uncertainStart && <p class="panel-note">{border.uncertainStart}</p>}
      {border.note && <p class="panel-note">{border.note}</p>}
      <p class="panel-source">
        {t('panel.sourceLabel')}{' '}
        {border.source.url ? (
          <a href={border.source.url} target="_blank" rel="noopener">
            {border.source.text}
          </a>
        ) : (
          border.source.text
        )}
      </p>
    </li>
  );
}

function Territory({ view, onClose }: { view: TerritoryView; onClose: () => void }) {
  return (
    <>
      <header class="panel-header">
        <div>
          <h2 id="panel-title">{view.name}</h2>
          {view.localName && <p class="panel-local">{view.localName}</p>}
        </div>
        <button type="button" class="panel-close" onClick={onClose} aria-label={t('panel.close')} title={t('panel.close')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
          </svg>
        </button>
      </header>
      {view.borders.length > 0 ? (
        <ul class="panel-borders">
          {view.borders.map((border) => (
            <Border key={border.id} border={border} />
          ))}
        </ul>
      ) : (
        <p class="panel-empty">{t('panel.noneInView', { name: view.name })}</p>
      )}
    </>
  );
}

export interface PanelOptions {
  /** The border records for a polity that the map has downloaded (HistoricalLayers.bordersOf). */
  bordersOf: (polity: string) => BorderRecord[];
  /** Called when the reader closes the panel, or when the selected ID isn't in our data. */
  onClose: () => void;
}

/** Puts the panel on the page and redraws it when the selection, the day, or the data changes. */
export class TerritoryPanel {
  private readonly container: HTMLElement;
  private readonly options: PanelOptions;
  private atlas: Atlas | null = null;
  private polity: string | null = null;
  private day: number;
  private records: BorderRecord[] = [];
  /** What was last drawn, to skip redrawing when nothing changed (e.g. during playback). */
  private drawn = '';

  constructor(container: HTMLElement, initialDay: number, options: PanelOptions) {
    this.container = container;
    this.day = initialDay;
    this.options = options;
    fetch(dataUrl('atlas.json'))
      .then((r) => r.json())
      .then((atlas: Atlas) => {
        this.atlas = atlas;
        this.draw();
      })
      .catch((error) => console.error('Could not load atlas.json', error));
  }

  /** Shows a polity (by ID), or closes the panel (null). */
  select(polity: string | null): void {
    this.polity = polity;
    this.refresh();
  }

  setDay(day: number): void {
    this.day = day;
    this.draw();
  }

  /** Re-reads the selected polity's borders from the map, e.g. after more tiles have loaded. */
  refresh(): void {
    this.records = this.polity ? this.options.bordersOf(this.polity) : [];
    this.draw();
  }

  private draw(): void {
    if (!this.polity || !this.atlas) return this.hide();
    const view = describeTerritory(this.atlas, this.polity, this.records, this.day, getLocale());
    if (!view) {
      // Not in our data (for example a mistyped link): close, as if the link had no selection.
      this.polity = null;
      this.hide();
      this.options.onClose();
      return;
    }
    const key = JSON.stringify(view);
    if (key === this.drawn) return;
    this.drawn = key;
    this.container.hidden = false;
    render(<Territory view={view} onClose={this.options.onClose} />, this.container);
  }

  private hide(): void {
    if (this.container.hidden) return;
    this.container.hidden = true;
    this.drawn = '';
    render(null, this.container);
  }
}
