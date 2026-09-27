import { describe, expect, it } from 'vitest';
import { civilToJdn } from '../dates/index.ts';
import { borderReportUrl } from './report.ts';

describe('borderReportUrl', () => {
  // Made-up territory and view (Testland).
  const url = borderReportUrl({
    name: 'Testland',
    polity: 'testland',
    day: civilToJdn(1901, 5, 12),
    viewLink: 'https://chronoatlas-org.github.io/chronoatlas/#d=1901-05-12&m=4.5/10/20&sel=testland',
  });

  it('opens the border correction form with the territory, date, and view filled in', () => {
    expect(url).toBe(
      'https://github.com/chronoatlas-org/chronoatlas/issues/new?template=border-correction.yml' +
        '&territory=Testland%20(testland)&date_range=1901-05-12' +
        '&view_link=https%3A%2F%2Fchronoatlas-org.github.io%2Fchronoatlas%2F%23d%3D1901-05-12%26m%3D4.5%2F10%2F20%26sel%3Dtestland',
    );
  });

  it('round-trips every value, including non-Latin names and BCE dates, and adds no labels', () => {
    const params = new URL(
      borderReportUrl({ name: 'テストランド & Co', polity: 'testland', day: civilToJdn(-220, 3, 15), viewLink: 'https://example.test/#a=1&b=2' }),
    ).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      template: 'border-correction.yml',
      territory: 'テストランド & Co (testland)',
      date_range: '-0220-03-15',
      view_link: 'https://example.test/#a=1&b=2',
    });
  });
});
