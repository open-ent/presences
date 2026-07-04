import { describe, expect, it } from 'vitest';

import { heure, ouiNon, seuil, visibleByLabel } from './utils';

describe('visibleByLabel', () => {
  it('retire les masqués et trie par libellé', () => {
    const arr = [
      { label: 'Zèbre', hidden: false },
      { label: 'caché', hidden: true },
      { label: 'Abeille', hidden: false },
    ];
    expect(visibleByLabel(arr).map((x) => x.label)).toEqual(['Abeille', 'Zèbre']);
  });
  it('tri insensible aux accents/casse', () => {
    const arr = [{ label: 'Éveil' }, { label: 'anglais' }, { label: 'Biologie' }];
    expect(visibleByLabel(arr).map((x) => x.label)).toEqual(['anglais', 'Biologie', 'Éveil']);
  });
});

describe('ouiNon', () => {
  it('mappe le booléen', () => {
    expect(ouiNon(true)).toBe('Oui');
    expect(ouiNon(false)).toBe('Non');
    expect(ouiNon(undefined)).toBe('Non');
  });
});

describe('seuil', () => {
  it('affiche le nombre ou un tiret', () => {
    expect(seuil(3)).toBe('3');
    expect(seuil(0)).toBe('—');
    expect(seuil(undefined)).toBe('—');
  });
});

describe('heure', () => {
  it('extrait HH:mm d’une date SQL ou ISO', () => {
    expect(heure('2025-10-14 08:00:00')).toBe('08:00');
    expect(heure('2025-10-14T09:30:00.000')).toBe('09:30');
  });
  it('renvoie vide si illisible', () => {
    expect(heure('')).toBe('');
    expect(heure(undefined)).toBe('');
  });
});
