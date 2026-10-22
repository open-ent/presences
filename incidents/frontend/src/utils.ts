/** Fonctions pures du module Incidents, testables. */

/** Formate une date backend (« YYYY-MM-DD… ») en « jj/mm/aaaa », vide si absente/invalide. */
export function dateFr(dateStr?: string): string {
  if (!dateStr) return '';
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Heure « HH:mm » extraite d'une date/heure backend, vide si absente. */
export function heure(dateStr?: string): string {
  if (!dateStr) return '';
  const m = /[T ](\d{2}):(\d{2})/.exec(dateStr);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** « Oui »/« Non » pour un booléen (statut traité d'un incident). */
export function ouiNon(v: boolean): string {
  return v ? 'Oui' : 'Non';
}

/**
 * Libellé synthétique des protagonistes d'un incident : « Nom (rôle), Nom (rôle) ».
 * Tolère les champs absents.
 */
export function protagonistesLabel(
  protagonists: Array<{ student?: { displayName?: string }; type?: { label?: string } }>,
): string {
  return (protagonists ?? [])
    .map((p) => {
      const nom = p.student?.displayName ?? '';
      const role = p.type?.label ?? '';
      return role ? `${nom} (${role})` : nom;
    })
    .filter((s) => s.trim() !== '')
    .join(', ');
}

/** Date locale au format `YYYY-MM-DD` (jour courant par défaut), sans passer par l'UTC (qui décale d'un jour le soir). */
export function todayIso(ref: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(ref.getDate())}`;
}

/** Année scolaire contenant `ref` : du 1er septembre au 31 août. Remplace les bornes 2025-2026 codées en dur. */
export function schoolYear(ref: Date = new Date()): { start: string; end: string } {
  const y = ref.getMonth() >= 8 ? ref.getFullYear() : ref.getFullYear() - 1;
  return { start: `${y}-09-01`, end: `${y + 1}-08-31` };
}
