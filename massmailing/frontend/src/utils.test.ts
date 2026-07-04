import { describe, expect, it } from 'vitest';

import { dateFr, totalCount, typeLabel } from './utils';

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
