// The "Report a problem with this border" link: GitHub's border correction form with the
// territory, the date, and a link to the view already filled in.
//
// GitHub fills a form field from a query parameter named after the field's `id`
// (.github/ISSUE_TEMPLATE/border-correction.yml). Those ids are stable, and
// scripts/issue-forms.test.ts checks that every field used here still exists in the form.
// No `labels` parameter: GitHub needs permission to add labels and answers 404 without it, and
// the form adds its own label.

import { formatDayForUrl } from './state.ts';

export const REPORT_FORM = {
  address: 'https://github.com/chronoatlas-org/chronoatlas/issues/new',
  template: 'border-correction.yml',
  fields: ['territory', 'date_range', 'view_link'],
} as const;

export interface ReportDetails {
  /** The name shown in the panel. */
  name: string;
  /** The polity's permanent ID, so reviewers can find the exact record. */
  polity: string;
  /** The selected day (a day number). */
  day: number;
  /** The full link to the current view, including the selection. */
  viewLink: string;
}

export function borderReportUrl({ name, polity, day, viewLink }: ReportDetails): string {
  const values: Record<(typeof REPORT_FORM.fields)[number], string> = {
    territory: `${name} (${polity})`,
    date_range: formatDayForUrl(day),
    view_link: viewLink,
  };
  const query = [`template=${REPORT_FORM.template}`, ...REPORT_FORM.fields.map((f) => `${f}=${encodeURIComponent(values[f])}`)];
  return `${REPORT_FORM.address}?${query.join('&')}`;
}
