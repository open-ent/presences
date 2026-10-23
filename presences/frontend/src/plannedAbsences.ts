/** Absences prévues : filtres, paramètres des requêtes, règles d'affichage (fonctions pures, testables). */

export interface PlannedFilters {
  structureId: string;
  /** Jours « YYYY-MM-DD » ; les heures par défaut sont ajoutées. */
  start: string;
  end: string;
  /** Heures de début et de fin (créneaux), « HH:mm » ; vides = journée entière. */
  startHour: string;
  endHour: string;
  studentIds: string[];
  classIds: string[];
  halfBoarders: boolean;
  interns: boolean;
  /** États : sans motif, justifiées non régularisées, justifiées régularisées. */
  noReasons: boolean;
  notRegularized: boolean;
  regularized: boolean;
  followed: boolean;
  notFollowed: boolean;
  reasonIds: number[];
}

export const START_DAY_TIME = '00:00:00';
export const END_DAY_TIME = '23:59:59';

export const initialPlannedFilters = (structureId: string, start: string, end: string, absenceReasonIds: number[]): PlannedFilters => ({
  structureId, start, end, startHour: '', endHour: '', studentIds: [], classIds: [], halfBoarders: false, interns: false,
  noReasons: true, notRegularized: true, regularized: true, followed: true, notFollowed: true, reasonIds: absenceReasonIds,
});

/** Régularisation demandée : aucune restriction (null) si tout est coché, ou si seul « sans motif » l'est. */
export function regularizedParam(f: Pick<PlannedFilters, 'noReasons' | 'regularized' | 'notRegularized'>): boolean | null {
  if ((f.noReasons && !f.regularized && !f.notRegularized) || (f.regularized && f.notRegularized)) return null;
  return f.regularized;
}

/** Suivi demandé : aucune restriction (null) si les deux sont cochés. */
export const followedParam = (f: Pick<PlannedFilters, 'followed' | 'notFollowed'>): boolean | null => (f.followed && f.notFollowed ? null : f.followed);

const withSeconds = (h: string) => (h.length === 5 ? `${h}:00` : h);

/** Début et fin envoyés au serveur : la journée entière, sauf créneaux choisis. */
export function plannedPeriod(f: Pick<PlannedFilters, 'start' | 'end' | 'startHour' | 'endHour'>): { start: string; end: string } {
  return {
    start: `${f.start} ${f.startHour ? withSeconds(f.startHour) : START_DAY_TIME}`,
    end: `${f.end} ${f.endHour ? withSeconds(f.endHour) : END_DAY_TIME}`,
  };
}

/** Paramètres communs à la liste et à l'export (sans structure ni page). */
export function plannedParams(f: PlannedFilters): string {
  const { start, end } = plannedPeriod(f);
  const regularized = regularizedParam(f);
  const followed = followedParam(f);
  let uri = `start=${start}&end=${end}`;
  if (regularized !== null) uri += `&regularized=${regularized}`;
  f.studentIds.forEach((s) => (uri += `&student=${s}`));
  f.classIds.forEach((c) => (uri += `&classes=${c}`));
  f.reasonIds.forEach((r) => (uri += `&reason=${r}`));
  uri += `&noReason=${f.noReasons}`;
  if (followed !== null) uri += `&followed=${followed}`;
  if (f.halfBoarders) uri += '&halfBoarder=true';
  if (f.interns) uri += '&internal=true';
  return uri;
}

export const listUrl = (f: PlannedFilters, page: number): string => `/presences/absences?structure=${f.structureId}&${plannedParams(f)}&page=${page}`;
export const exportUrl = (f: PlannedFilters, type: 'PDF' | 'CSV'): string =>
  `/presences/structures/${f.structureId}/absences/export/${type === 'PDF' ? 'pdf' : 'csv'}?${plannedParams(f)}`;

/** Les motifs sont tous retenus au départ (comme l'AngularJS) tant qu'un état justifié est coché. */
export const defaultReasonIds = (reasons: Array<{ id: number }>): number[] => reasons.map((r) => r.id);

export interface PlannedAbsence {
  id: number;
  structure_id?: string;
  student?: { id?: string; name?: string; displayName?: string; className?: string };
  start_date: string;
  end_date: string;
  reason_id?: number | null;
  reason?: { id?: number | null; label?: string } | null;
  owner?: { displayName?: string } | string | null;
  counsellor_regularisation?: boolean;
  followed?: boolean;
}

/** « le 22/10/2026 » ou « du 22/10/2026 au 24/10/2026 ». */
export function absenceDates(a: Pick<PlannedAbsence, 'start_date' | 'end_date'>): string {
  const fr = (d: string) => d.replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1');
  const s = fr(a.start_date);
  const e = fr(a.end_date);
  return s === e ? `le ${s}` : `du ${s} au ${e}`;
}

/** La case « régularisée » n'existe que pour un motif non justifiant ; elle ne peut plus être décochée si la ligne n'y est pas éligible. */
export function regularizeState(a: PlannedAbsence, provingById: Record<number, boolean>): { visible: boolean; disabled: boolean } {
  const reasonId = a.reason?.id ?? a.reason_id ?? null;
  const eligible = reasonId !== null && !provingById[reasonId];
  return { visible: eligible, disabled: !eligible && Boolean(a.counsellor_regularisation) };
}

export const ownerName = (a: PlannedAbsence): string => (typeof a.owner === 'string' ? '' : (a.owner?.displayName ?? ''));
