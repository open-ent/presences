import { describe, expect, it } from 'vitest';

import { statCount, statLabel, statTotal } from './utils';

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
