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

/**
 * Extrait l'heure « HH:mm » d'une date de cours (« 2025-10-14 08:00:00 » ou ISO « …T08:00:00 »).
 * Renvoie '' si illisible.
 */
export function heure(dateStr?: string): string {
  if (!dateStr) return '';
  const m = /[ T](\d{2}):(\d{2})/.exec(dateStr);
  return m ? `${m[1]}:${m[2]}` : '';
}
