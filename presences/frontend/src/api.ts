// Client REST du module Présences (presences) — session ENT, même origine.
// Incrément 1 : lecture seule du paramétrage de la structure (motifs, actions, dispositifs, réglages).

/** Motif d'absence de la structure. */
export interface Reason {
  id: number;
  structure_id?: string;
  label: string;
  proving?: boolean;
  default?: boolean;
  hidden?: boolean;
}

/** Action/mesure paramétrée (ex. « Appel reçu »). */
export interface Action {
  id: number;
  label: string;
  abbreviation?: string;
  hidden?: boolean;
}

/** Dispositif / discipline (ex. « Infirmerie »). */
export interface Discipline {
  id: number;
  label: string;
  used?: boolean;
  hidden?: boolean;
}

/** Réglages d'alerte de la structure. */
export interface Settings {
  alert_absence_threshold?: number;
  alert_lateness_threshold?: number;
  alert_incident_threshold?: number;
  alert_forgotten_notebook_threshold?: number;
  allow_multiple_slots?: boolean;
}

/** Corps de POST /presences/reason (cf. jsonschema/reasonCreate.json, tous requis). */
export interface ReasonInput {
  structureId: string;
  label: string;
  absenceCompliance: boolean;
  proving: boolean;
  excludeAlertRegularised: boolean;
  excludeAlertNoRegularised: boolean;
}

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

// ── Référentiels de paramétrage (lecture seule) ────────────────────────────────
/** Motifs d'absence (au moins un motif système présent après init). */
export const getReasons = async (structureId: string): Promise<Reason[]> =>
  json<Reason[]>(await fetch(`/presences/reasons?structureId=${structureId}`, base));

/** Actions/mesures paramétrées de la structure. */
export const getActions = async (structureId: string): Promise<Action[]> =>
  json<Action[]>(await fetch(`/presences/actions?structureId=${structureId}`, base));

/** Dispositifs / disciplines de la structure. */
export const getDisciplines = async (structureId: string): Promise<Discipline[]> =>
  json<Discipline[]>(await fetch(`/presences/disciplines?structureId=${structureId}`, base));

/** Réglages d'alerte de la structure. */
export const getSettings = async (structureId: string): Promise<Settings> =>
  json<Settings>(await fetch(`/presences/structures/${structureId}/settings`, base));

// ── Écriture (paramétrage des motifs) ──────────────────────────────────────────
/** Crée un motif d'absence (POST /presences/reason). Renvoie l'id créé. */
export const createReason = async (input: ReasonInput): Promise<{ id: number }> =>
  json<{ id: number }>(
    await fetch(`/presences/reason`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(input) }),
  );

/** Supprime un motif d'absence (DELETE /presences/reason?id=). */
export const deleteReason = async (id: number): Promise<void> => {
  const res = await fetch(`/presences/reason?id=${id}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

export const api = { getReasons, getActions, getDisciplines, getSettings, createReason, deleteReason };
