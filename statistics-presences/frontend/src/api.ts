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
  ).catch(() => ({ data: [] }));
};

export const api = { getGlobalStats };
