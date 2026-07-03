/** Fonctions pures du module Présences, testables. */

/** Filtre les entrées masquées (`hidden`) puis trie par libellé (FR, insensible casse/accents). */
export function visibleByLabel<T extends { label: string; hidden?: boolean }>(items: T[]): T[] {
  return items
    .filter((i) => !i.hidden)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
}

/** Libellé « oui/non » d'un booléen (pour l'affichage FR). */
export function ouiNon(v?: boolean): string {
  return v ? 'Oui' : 'Non';
}

/** Formate un seuil d'alerte : nombre affiché, ou « — » si non défini/nul. */
export function seuil(v?: number): string {
  return typeof v === 'number' && v > 0 ? String(v) : '—';
}
