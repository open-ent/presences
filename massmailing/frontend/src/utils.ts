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
