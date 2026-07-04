import { MassmailingType } from './api';

/** Libellé français d'un type d'événement publipostable. */
export function typeLabel(type: MassmailingType | string): string {
  const labels: Record<string, string> = {
    UNREGULARIZED: 'Absences non régularisées',
    REGULARIZED: 'Absences régularisées',
    LATENESS: 'Retards',
    PUNISHMENT: 'Punitions',
    SANCTION: 'Sanctions',
    NO_REASON: 'Absences sans motif',
  };
  return labels[type] ?? type;
}

/** Date FR courte depuis une date ISO (tolère l'absence). */
export function dateFr(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
}

/** Somme des compteurs d'un élève ({UNREGULARIZED: 2, LATENESS: 1} → 3). */
export function totalCount(count?: Record<string, number>): number {
  return Object.values(count ?? {}).reduce((a, b) => a + (b || 0), 0);
}
