// Client REST du module Statistiques de présences (statistics-presences) — session ENT, même origine.
// Migration AngularJS -> React (CCTP 51C) : indicateur Global (compteurs + tableau élèves).

function xsrfHeader(): Record<string, string> {
  const m = typeof document !== 'undefined' ? document.cookie.match(/XSRF-TOKEN=([^;]+)/) : null;
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const base = { credentials: 'include' as const };
const mutHeaders = () => ({ 'Content-Type': 'application/json', ...xsrfHeader() });

/** Types d'événement de l'indicateur Global. */
export const STAT_TYPES = ['UNREGULARIZED', 'REGULARIZED', 'NO_REASON', 'LATENESS', 'DEPARTURE', 'PUNISHMENT', 'SANCTION'] as const;
export type StatType = (typeof STAT_TYPES)[number];

/** Ligne élève de l'indicateur Global. */
export interface StatStudent {
  id: string;
  name?: string;
  audience?: string;
  statistics?: Record<string, { count?: number } | number>;
}

/** Réponse de l'indicateur Global. */
export interface GlobalStats {
  data: StatStudent[];
  count?: Record<string, number>;
  rate?: Record<string, number>;
}

/** Statistiques Global (POST de LECTURE /structures/:id/indicators/Global). */
export const getGlobalStats = async (structureId: string, start: string, end: string, types: StatType[], page = 0): Promise<GlobalStats> => {
  const body = {
    start,
    end,
    types,
    audiences: [],
    users: [],
    reasons: [],
    punishmentTypes: [],
    sanctionTypes: [],
    filters: {},
  };
  return json<GlobalStats>(
    await fetch(`/statistics-presences/structures/${structureId}/indicators/Global?page=${page}`, {
      ...base,
      method: 'POST',
      headers: mutHeaders(),
      body: JSON.stringify(body),
    }),
  );
};

// ── Indicateurs (Global, Mensuel, Hebdomadaire) ──────────────────────────────────
import type { IndicatorBody, IndicatorName, MonthlyAudience, PunishmentType, Reason, Slot, WeeklyRow } from './indicators';

/** Réponse de l'indicateur Global : lignes élèves + totaux, taux et créneaux par type. */
export interface GlobalResponse {
  data: Array<{ id: string; name: string; audience: string; statistics: Record<string, { count: number; rate?: number; slots?: number; max?: boolean }> }>;
  count: Record<string, number>;
  rate: Record<string, number>;
  slots: Record<string, number>;
}
export interface MonthlyResponse { data: MonthlyAudience[]; months?: string[] }
export interface MonthlyGraphResponse { data: Record<string, Array<Record<string, { count: number }>>> | null; months: string[] }
export interface WeeklyResponse { data: WeeklyRow[] }

const post = (url: string, body: unknown) => fetch(url, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(body) });

/** Lecture d'un indicateur (POST de lecture) : 20 lignes par page. */
export const getIndicator = async <T>(structureId: string, name: IndicatorName, body: IndicatorBody, page = 0): Promise<T> =>
  json<T>(await post(`/statistics-presences/structures/${structureId}/indicators/${name}?page=${page}`, body));

/** Données du graphique mensuel. */
export const getMonthlyGraph = async (structureId: string, body: IndicatorBody): Promise<MonthlyGraphResponse> =>
  json<MonthlyGraphResponse>(await post(`/statistics-presences/structures/${structureId}/indicators/Monthly/graph`, body));

/** Recalcule les statistiques de certains élèves. */
export const refreshStudents = async (structureId: string, studentIds: string[]): Promise<void> => {
  const res = await post(`/statistics-presences/structures/${structureId}/process/students/statistics/tasks`, { studentIds });
  if (!res.ok) throw new Error(String(res.status));
};

export interface Person { id: string; name: string }

/** Élèves de la structure dont le nom correspond. */
export const searchStudents = async (structureId: string, q: string): Promise<Person[]> =>
  json<Array<{ id: string; displayName?: string; firstName?: string; lastName?: string }>>(
    await fetch(`/presences/search/students?structureId=${structureId}&q=${encodeURIComponent(q)}&field=firstName&field=lastName`, base),
  ).then((a) => (a ?? []).map((u) => ({ id: u.id, name: u.displayName ?? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() })));

/** Classes, groupes et regroupements dont le nom correspond (les regroupements seulement hors vue hebdomadaire). */
export const searchAudiences = async (structureId: string, q: string, withGroupings: boolean): Promise<Person[]> => {
  const groups = await json<Array<{ id: string; name: string }>>(await fetch(`/presences/search/groups?structureId=${structureId}&q=${encodeURIComponent(q)}&field=name`, base));
  const out: Person[] = (groups ?? []).map((g) => ({ id: g.id, name: g.name }));
  if (withGroupings) {
    const res = await fetch(`/presences/grouping/structure/${structureId}/list?searchValue=${encodeURIComponent(q.replace(/\s/g, '').toLowerCase())}`, base);
    if (res.ok) out.push(...((await res.json().catch(() => [])) as Array<{ id: string; name: string }>).map((g) => ({ id: g.id, name: g.name })));
  }
  return out;
};

/** Motifs d'absence et de retard (le motif -1 technique est écarté). */
export const getAllReasons = async (structureId: string): Promise<Reason[]> =>
  json<Reason[]>(await fetch(`/presences/reasons?structureId=${structureId}&reasonTypeId=0`, base)).then((a) => (a ?? []).filter((r) => r.id !== -1));

/** Types de punition et de sanction. */
export const getPunishmentTypes = async (structureId: string): Promise<PunishmentType[]> =>
  json<PunishmentType[]>(await fetch(`/incidents/punishments/type?structureId=${structureId}`, base)).then((a) => (a ?? []).filter((t) => !t.hidden));

/** Réglages de présences de la structure (mode de récupération des événements). */
export const getSettings = async (structureId: string): Promise<{ event_recovery_method?: 'HOUR' | 'HALF_DAY' | 'DAY' }> => {
  const res = await fetch(`/presences/structures/${structureId}/settings`, base);
  return res.ok ? ((await res.json().catch(() => ({}))) ?? {}) : {};
};

/** Dates de l'année scolaire de la structure. */
export const getSchoolYear = async (structureId: string): Promise<{ start: string; end: string } | null> => {
  const res = await fetch(`/viescolaire/settings/periode/schoolyear?structureId=${structureId}`, base);
  if (!res.ok) return null;
  const d = (await res.json().catch(() => null)) as { start_date?: string; end_date?: string } | null;
  return d?.start_date && d?.end_date ? { start: d.start_date.slice(0, 10), end: d.end_date.slice(0, 10) } : null;
};

/** Créneaux horaires : profil de la structure, ou celui d'une classe. */
export const getSlots = async (structureId: string, audienceId?: string): Promise<Slot[]> => {
  const res = await fetch(audienceId ? `/viescolaire/timeslot/audience/${audienceId}` : `/viescolaire/structures/${structureId}/time-slot`, base);
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json().catch(() => null)) as { slots?: Slot[] } | null)?.slots ?? [];
};

/** Classe d'un élève (pour retrouver ses créneaux). */
export const getStudentAudience = async (structureId: string, studentId: string): Promise<string | null> => {
  const res = await fetch(`/viescolaire/eleves?idUser=${studentId}&idStructure=${structureId}`, base);
  if (!res.ok) return null;
  const a = (await res.json().catch(() => [])) as Array<{ idClasse?: string }>;
  return a?.[0]?.idClasse ?? null;
};

export const api = {
  getGlobalStats, getIndicator, getMonthlyGraph, refreshStudents, searchStudents, searchAudiences,
  getAllReasons, getPunishmentTypes, getSettings, getSchoolYear, getSlots, getStudentAudience,
};
