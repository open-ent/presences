/** Libellé français d'un type d'événement statistique. */
export function statLabel(type: string): string {
  const labels: Record<string, string> = {
    UNREGULARIZED: 'Absences non régularisées',
    REGULARIZED: 'Absences régularisées',
    NO_REASON: 'Absences sans motif',
    LATENESS: 'Retards',
    DEPARTURE: 'Départs anticipés',
    PUNISHMENT: 'Punitions',
    SANCTION: 'Sanctions',
    ABSENCE_TOTAL: 'Total absences',
    STUDENTS: 'Élèves',
  };
  return labels[type] ?? type;
}

/** Compteur d'une statistique élève ({count: 2} ou 2 → 2). */
export function statCount(v?: { count?: number } | number): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : (v.count ?? 0);
}

/** Total des statistiques d'un élève. */
export function statTotal(stats?: Record<string, { count?: number } | number>): number {
  return Object.values(stats ?? {}).reduce((a: number, v) => a + statCount(v), 0);
}
