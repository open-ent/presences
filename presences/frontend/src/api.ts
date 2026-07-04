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

/** Élève (annuaire). */
export interface Eleve {
  id: string;
  displayName: string;
}

/** Une absence saisie. */
export interface Absence {
  id: number;
  start_date?: string;
  end_date?: string;
  reason_id?: number | null;
  student_id?: string;
  counsellor_regularisation?: boolean;
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

/** Crée une action (POST /presences/action). L'abréviation est dérivée du libellé si absente. */
export const createAction = async (structureId: string, label: string, abbreviation?: string): Promise<{ id: number }> =>
  json<{ id: number }>(
    await fetch(`/presences/action`, {
      ...base,
      method: 'POST',
      headers: mutHeaders(),
      body: JSON.stringify({ structureId, label, abbreviation: (abbreviation || label).slice(0, 8) }),
    }),
  );

/** Supprime une action (DELETE /presences/action?id=). */
export const deleteAction = async (id: number): Promise<void> => {
  const res = await fetch(`/presences/action?id=${id}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

/** Crée un dispositif (POST /presences/discipline). */
export const createDiscipline = async (structureId: string, label: string): Promise<{ id: number }> =>
  json<{ id: number }>(
    await fetch(`/presences/discipline`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify({ structureId, label }) }),
  );

/** Supprime un dispositif (DELETE /presences/discipline?id=). */
export const deleteDiscipline = async (id: number): Promise<void> => {
  const res = await fetch(`/presences/discipline?id=${id}`, { ...base, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

// ── Saisie d'absences (nécessite droit ADML / vie sco) ──────────────────────────
/** Élèves de la structure (annuaire), triés par nom. */
export const getStudents = async (structureId: string): Promise<Eleve[]> =>
  json<Array<{ id: string; type?: string; displayName?: string }>>(
    await fetch(`/directory/structure/${structureId}/users`, base),
  ).then((arr) =>
    arr.filter((u) => u.type === 'Student').map((u) => ({ id: u.id, displayName: u.displayName ?? u.id }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })),
  );

/** Absences d'un élève sur une période. */
export const getStudentAbsences = async (structureId: string, studentId: string, start: string, end: string): Promise<Absence[]> => {
  const url = `/presences/absences?structureId=${structureId}&startDate=${start}&endDate=${end}&studentId=${studentId}`;
  return json<{ all?: Absence[] } | Absence[]>(await fetch(url, base)).then((d) => (Array.isArray(d) ? d : d.all ?? [])).catch(() => []);
};

/** Crée une absence (POST /presences/absence). Dates « YYYY-MM-DD HH:mm:ss ». */
export const createAbsence = async (structureId: string, studentId: string, startDate: string, endDate: string, reasonId: number | null): Promise<void> => {
  const res = await fetch(`/presences/absence`, {
    ...base,
    method: 'POST',
    headers: mutHeaders(),
    body: JSON.stringify({ structure_id: structureId, student_id: studentId, start_date: startDate, end_date: endDate, reason_id: reasonId, counsellor_regularisation: false }),
  });
  if (!res.ok && res.status !== 201) throw new Error(String(res.status));
};

export const api = {
  getReasons, getActions, getDisciplines, getSettings,
  createReason, deleteReason,
  createAction, deleteAction,
  createDiscipline, deleteDiscipline,
  getStudents, getStudentAbsences, createAbsence,
};
