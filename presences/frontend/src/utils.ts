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

/** Libellé FR d'un type d'alerte présences (clé de la synthèse). */
export function alerteLabel(type: string): string {
  switch (type) {
    case 'ABSENCE': return 'Absences';
    case 'LATENESS': return 'Retards';
    case 'INCIDENT': return 'Incidents';
    case 'FORGOTTEN_NOTEBOOK': return 'Oublis de carnet';
    default: return type;
  }
}

/** Ordre d'affichage des types d'alerte sur le tableau de bord. */
export const ALERT_TYPES = ['ABSENCE', 'LATENESS', 'INCIDENT', 'FORGOTTEN_NOTEBOOK'] as const;

/** Date « YYYY-MM-DD » (jour local) à partir d'une Date. */
export function jour(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Formate une date backend « YYYY-MM-DD… » en « jj/mm/aaaa » (sans dépendre du fuseau). */
export function dateFr(dateStr?: string): string {
  if (!dateStr) return '';
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Libellé de classe/groupe d'un registre oublié (premier disponible), ou « — ». */
export function classeLabel(r: { classes?: string[]; groups?: string[]; class_name?: string }): string {
  if (r.class_name) return r.class_name;
  const first = (r.classes && r.classes[0]) || (r.groups && r.groups[0]);
  return first || '—';
}

/** Nom affichable d'une déclaration/élève à partir des champs possibles du backend. */
export function eleveNom(s: { display_name?: string; student?: { displayName?: string; name?: string }; student_id?: string }): string {
  return s.display_name || s.student?.displayName || s.student?.name || s.student_id || '—';
}
