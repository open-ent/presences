import { describe, expect, it } from 'vitest';

import { alerteLabel, classeLabel, dateFr, eleveNom, heure, jour, ouiNon, seuil, visibleByLabel } from './utils';

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

describe('alerteLabel', () => {
  it('mappe les types connus, passe-plat sinon', () => {
    expect(alerteLabel('ABSENCE')).toBe('Absences');
    expect(alerteLabel('LATENESS')).toBe('Retards');
    expect(alerteLabel('INCIDENT')).toBe('Incidents');
    expect(alerteLabel('FORGOTTEN_NOTEBOOK')).toBe('Oublis de carnet');
    expect(alerteLabel('AUTRE')).toBe('AUTRE');
  });
});

describe('jour', () => {
  it('formate une Date en YYYY-MM-DD (jour local)', () => {
    expect(jour(new Date(2026, 6, 4))).toBe('2026-07-04');
    expect(jour(new Date(2025, 0, 9))).toBe('2025-01-09');
  });
});

describe('dateFr', () => {
  it('convertit une date backend en jj/mm/aaaa', () => {
    expect(dateFr('2026-07-04 08:00:00')).toBe('04/07/2026');
    expect(dateFr('2025-01-09T10:30:00.000')).toBe('09/01/2025');
    expect(dateFr(undefined)).toBe('');
    expect(dateFr('xxx')).toBe('');
  });
});

describe('classeLabel', () => {
  it('privilégie class_name, sinon 1re classe/groupe, sinon tiret', () => {
    expect(classeLabel({ class_name: '2PROCRM' })).toBe('2PROCRM');
    expect(classeLabel({ classes: ['6A', '6B'] })).toBe('6A');
    expect(classeLabel({ groups: ['Groupe LV1'] })).toBe('Groupe LV1');
    expect(classeLabel({})).toBe('—');
  });
});

describe('eleveNom', () => {
  it('choisit le premier nom disponible', () => {
    expect(eleveNom({ display_name: 'DOE John' })).toBe('DOE John');
    expect(eleveNom({ student: { displayName: 'ROE Jane' } })).toBe('ROE Jane');
    expect(eleveNom({ student: { name: 'X' } })).toBe('X');
    expect(eleveNom({ student_id: 'id-1' })).toBe('id-1');
    expect(eleveNom({})).toBe('—');
  });
});
