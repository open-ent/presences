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
