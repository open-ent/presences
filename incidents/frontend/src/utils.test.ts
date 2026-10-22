import { describe, expect, it } from 'vitest';

import { dateFr, heure, ouiNon, protagonistesLabel, schoolYear, todayIso } from './utils';

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

describe('dates par défaut', () => {
  it('année scolaire : septembre à août, quel que soit le mois courant', () => {
    expect(schoolYear(new Date(2026, 9, 22))).toEqual({ start: '2026-09-01', end: '2027-08-31' });
    expect(schoolYear(new Date(2027, 0, 5))).toEqual({ start: '2026-09-01', end: '2027-08-31' });
    expect(schoolYear(new Date(2026, 7, 31))).toEqual({ start: '2025-09-01', end: '2026-08-31' });
    expect(schoolYear(new Date(2026, 8, 1))).toEqual({ start: '2026-09-01', end: '2027-08-31' });
  });
  it('jour courant au format ISO, sans décalage UTC', () => {
    expect(todayIso(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22');
    expect(todayIso(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
