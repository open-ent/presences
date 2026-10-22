import { describe, expect, it } from 'vitest';

import { dateFr, totalCount, typeLabel, schoolYear, todayIso } from './utils';

describe('typeLabel', () => {
  it('traduit les types connus', () => {
    expect(typeLabel('UNREGULARIZED')).toBe('Absences non régularisées');
    expect(typeLabel('LATENESS')).toBe('Retards');
  });
  it('rend le type brut si inconnu', () => {
    expect(typeLabel('AUTRE')).toBe('AUTRE');
  });
});

describe('dateFr', () => {
  it('formate une date ISO', () => {
    expect(dateFr('2026-07-04T10:00:00')).toBe('04/07/2026');
  });
  it('tolère les valeurs absentes ou invalides', () => {
    expect(dateFr(undefined)).toBe('');
    expect(dateFr('n/a')).toBe('');
  });
});

describe('totalCount', () => {
  it('somme les compteurs', () => {
    expect(totalCount({ UNREGULARIZED: 2, LATENESS: 1 })).toBe(3);
  });
  it('tolère un objet vide ou absent', () => {
    expect(totalCount({})).toBe(0);
    expect(totalCount(undefined)).toBe(0);
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
