// Client REST du module Incidents (incidents) — session ENT, même origine.
// Migration AngularJS -> React (CCTP 51C) : lecture des incidents et des punitions/sanctions.

import { protagonistesLabel } from './utils';

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

// ── Incidents ────────────────────────────────────────────────────────────────────
/** Un incident aplati (libellés résolus en clair). */
export interface Incident {
  id: number;
  date: string;
  description: string;
  processed: boolean;
  typeLabel: string;
  placeLabel: string;
  partnerLabel: string;
  seriousnessLabel: string;
  protagonistes: string;
}

/** Structure renvoyée par GET /incidents/incidents. */
interface IncidentsResponse {
  all?: Array<{
    id: number;
    date?: string;
    description?: string;
    processed?: boolean;
    incident_type?: { label?: string } | null;
    place?: { label?: string } | null;
    partner?: { label?: string } | null;
    seriousness?: { label?: string } | null;
    protagonists?: Array<{ student?: { displayName?: string }; type?: { label?: string } }>;
  }>;
}

/** Incidents de la structure, aplatis (GET /incidents/incidents). */
export const getIncidents = async (structureId: string, startDate: string, endDate: string): Promise<Incident[]> => {
  const url = `/incidents/incidents?structureId=${structureId}&startDate=${startDate}&endDate=${endDate}&page=0`;
  const data = await json<IncidentsResponse>(await fetch(url, base)).catch(() => ({ all: [] as IncidentsResponse['all'] }));
  return (data.all ?? []).map((i) => ({
    id: i.id,
    date: i.date ?? '',
    description: i.description ?? '',
    processed: Boolean(i.processed),
    typeLabel: i.incident_type?.label ?? '',
    placeLabel: i.place?.label ?? '',
    partnerLabel: i.partner?.label ?? '',
    seriousnessLabel: i.seriousness?.label ?? '',
    protagonistes: protagonistesLabel(i.protagonists ?? []),
  }));
};

// ── Punitions / sanctions ────────────────────────────────────────────────────────
/** Une punition/sanction aplatie. */
export interface Punishment {
  id: string;
  studentName: string;
  typeLabel: string;
  description: string;
  createdAt: string;
}

/** Structure renvoyée par GET /incidents/punishments. */
interface PunishmentsResponse {
  all?: Array<{
    id: string;
    student?: { displayName?: string };
    type?: { label?: string };
    fields?: { description?: string };
    created_at?: string;
  }>;
}

/** Punitions/sanctions de la structure (GET /incidents/punishments). */
export const getPunishments = async (structureId: string, startAt: string, endAt: string): Promise<Punishment[]> => {
  const url = `/incidents/punishments?structure_id=${structureId}&start_at=${startAt}&end_at=${endAt}`;
  const data = await json<PunishmentsResponse>(await fetch(url, base)).catch(() => ({ all: [] as PunishmentsResponse['all'] }));
  return (data.all ?? []).map((p) => ({
    id: p.id,
    studentName: p.student?.displayName ?? '',
    typeLabel: p.type?.label ?? '',
    description: p.fields?.description ?? '',
    createdAt: p.created_at ?? '',
  }));
};

// ── Types de sanction (référentiel, pour information) ─────────────────────────────
/** Un type de sanction/punition. */
export interface PunishmentType {
  id: number;
  label: string;
  type?: string;
}

/** Types de punition/sanction de la structure (GET /incidents/punishments/type). */
export const getPunishmentTypes = async (structureId: string): Promise<PunishmentType[]> =>
  json<PunishmentType[]>(await fetch(`/incidents/punishments/type?structureId=${structureId}`, base)).catch(() => []);

/** Marque un incident comme traité / non traité (PUT /incidents/incidents/:id — réservé par droit). */
export const setIncidentProcessed = async (id: number, processed: boolean): Promise<void> => {
  const res = await fetch(`/incidents/incidents/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify({ processed }) });
  if (!res.ok) throw new Error(String(res.status));
};

export const api = { getIncidents, getPunishments, getPunishmentTypes, setIncidentProcessed };
