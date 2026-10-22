import { describe, expect, it } from 'vitest';

import { statCount, statLabel, statTotal, schoolYear, todayIso } from './utils';

describe('statLabel', () => {
  it('traduit les types connus', () => {
    expect(statLabel('NO_REASON')).toBe('Absences sans motif');
    expect(statLabel('LATENESS')).toBe('Retards');
  });
  it('rend le type brut si inconnu', () => {
    expect(statLabel('AUTRE')).toBe('AUTRE');
  });
});

describe('statCount', () => {
  it('lit un objet {count} ou un nombre brut', () => {
    expect(statCount({ count: 3 })).toBe(3);
    expect(statCount(2)).toBe(2);
  });
  it('tolère les valeurs absentes', () => {
    expect(statCount(undefined)).toBe(0);
    expect(statCount({})).toBe(0);
  });
});

describe('statTotal', () => {
  it('somme les compteurs par type', () => {
    expect(statTotal({ NO_REASON: { count: 1 }, LATENESS: 2 })).toBe(3);
  });
  it('tolère un objet vide ou absent', () => {
    expect(statTotal({})).toBe(0);
    expect(statTotal(undefined)).toBe(0);
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
