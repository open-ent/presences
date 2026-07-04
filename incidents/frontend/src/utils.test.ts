import { describe, expect, it } from 'vitest';

import { dateFr, heure, ouiNon, protagonistesLabel } from './utils';

describe('dateFr', () => {
  it('convertit une date backend en jj/mm/aaaa', () => {
    expect(dateFr('2026-07-03T07:41:00.000')).toBe('03/07/2026');
    expect(dateFr('2026-01-05 08:00:00')).toBe('05/01/2026');
    expect(dateFr(undefined)).toBe('');
    expect(dateFr('xxx')).toBe('');
  });
});

describe('heure', () => {
  it('extrait HH:mm', () => {
    expect(heure('2026-07-03T07:41:00.000')).toBe('07:41');
    expect(heure('2026-07-03 14:30:00')).toBe('14:30');
    expect(heure(undefined)).toBe('');
  });
});

describe('ouiNon', () => {
  it('mappe le booléen', () => {
    expect(ouiNon(true)).toBe('Oui');
    expect(ouiNon(false)).toBe('Non');
  });
});

describe('protagonistesLabel', () => {
  it('assemble « Nom (rôle) » séparés par des virgules', () => {
    const p = [
      { student: { displayName: 'ALBANESE001 Lowens' }, type: { label: 'Fautif' } },
      { student: { displayName: "ADIL001 Na'il" }, type: { label: 'Fautif' } },
    ];
    expect(protagonistesLabel(p)).toBe("ALBANESE001 Lowens (Fautif), ADIL001 Na'il (Fautif)");
  });
  it('tolère rôle ou nom absents', () => {
    expect(protagonistesLabel([{ student: { displayName: 'X' } }])).toBe('X');
    expect(protagonistesLabel([{ type: { label: 'Témoin' } }])).toBe(' (Témoin)');
    expect(protagonistesLabel([])).toBe('');
  });
});
