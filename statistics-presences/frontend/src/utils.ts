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
