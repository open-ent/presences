import { describe, expect, it } from 'vitest';

import { dateFr, heure, ouiNon, incidentPrefill, protagonistesLabel, schoolYear, todayIso } from './utils';

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

describe('incidentPrefill', () => {
  const p = (q: string) => incidentPrefill(new URLSearchParams(q));
  it('lit élève, date et heure', () => {
    expect(p('student=e1~DUPONT%20L%C3%A9a&date=2026-10-23&time=08:15')).toEqual({ student: { id: 'e1', name: 'DUPONT Léa' }, date: '2026-10-23', time: '08:15' });
  });
  it('accepte un identifiant seul et ignore date/heure invalides', () => {
    expect(p('student=e1&date=demain&time=8h')).toEqual({ student: { id: 'e1', name: 'e1' }, date: undefined, time: undefined });
  });
  it('renvoie null sans élève', () => {
    expect(p('date=2026-10-23')).toBeNull();
    expect(p('student=~x')).toBeNull();
  });
});
