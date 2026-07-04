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

// ── Registre d'appel (cours du jour → appel → présence/absence) ─────────────────
/** Un cours du jour (source EDT). */
export interface Course {
  id: string;
  subjectId?: string;
  subjectName?: string;
  classes?: string[];
  groups?: string[];
  roomLabels?: string[];
  startDate?: string;
  endDate?: string;
  register_id?: number | null;
}

/** Cours d'une structure sur une journée (pour l'appel). */
export const getCourses = async (structureId: string, date: string): Promise<Course[]> => {
  const url = `/presences/courses?structure=${structureId}&start=${date}&end=${date}`;
  return json<Course[]>(await fetch(url, base)).catch(() => []);
};

/** Classe de la structure (pour résoudre un nom de classe → identifiant). */
export interface Classe {
  id: string;
  name: string;
}

/** Classes de la structure (via le référentiel vie scolaire). */
export const getClasses = async (structureId: string): Promise<Classe[]> =>
  json<Array<{ id: string; name: string }>>(
    await fetch(`/viescolaire/classes?idEtablissement=${structureId}`, base),
  ).then((arr) => (arr ?? []).map((c) => ({ id: c.id, name: c.name }))).catch(() => []);

/** Élèves d'une classe (annuaire directory), triés par nom. */
export const getClassStudents = async (classId: string): Promise<Eleve[]> =>
  json<Array<{ id: string; firstName?: string; lastName?: string; displayName?: string }>>(
    await fetch(`/directory/class/${classId}/users?type=Student`, base),
  ).then((arr) =>
    (arr ?? [])
      .map((u) => ({ id: u.id, displayName: u.displayName ?? (`${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || u.id) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })),
  );

/** Ouvre (crée) le registre d'un cours. Renvoie l'id du registre. */
export const createRegister = async (course: Course, structureId: string): Promise<{ id: number }> =>
  json<{ id: number }>(
    await fetch(`/presences/registers`, {
      ...base,
      method: 'POST',
      headers: mutHeaders(),
      body: JSON.stringify({
        course_id: course.id,
        structure_id: structureId,
        start_date: course.startDate,
        end_date: course.endDate,
        subject_id: course.subjectId ?? '',
        groups: course.groups ?? [],
        classes: course.classes ?? [],
        teacherIds: [],
        split_slot: false,
      }),
    }),
  );

/** Enregistre un événement d'appel (type_id : 1 = absence). */
export const createEvent = async (registerId: number, studentId: string, startDate: string, endDate: string, typeId = 1): Promise<void> => {
  const res = await fetch(`/presences/events`, {
    ...base,
    method: 'POST',
    headers: mutHeaders(),
    body: JSON.stringify({
      register_id: registerId,
      type_id: typeId,
      student_id: studentId,
      start_date: startDate,
      end_date: endDate,
      counsellor_input: true,
      counsellor_regularisation: false,
      reason_id: null,
    }),
  });
  if (!res.ok && res.status !== 201) throw new Error(String(res.status));
};

// ── Tableau de bord d'accueil (alertes / appels oubliés / déclarations parents) ─
/** Synthèse des alertes de la structure : nombre d'élèves franchissant chaque seuil, par type. */
export interface AlertSummary {
  ABSENCE?: number;
  LATENESS?: number;
  INCIDENT?: number;
  FORGOTTEN_NOTEBOOK?: number;
}

/** Synthèse des alertes (GET /presences/structures/:id/alerts/summary). */
export const getAlertSummary = async (structureId: string): Promise<AlertSummary> =>
  json<AlertSummary>(await fetch(`/presences/structures/${structureId}/alerts/summary`, base)).catch(() => ({}));

/** Un appel oublié (registre non fait du jour) : cours + classe + horaire + enseignant. */
export interface ForgottenRegister {
  id?: number | string;
  course_id?: string;
  subject_name?: string;
  subject?: { name?: string };
  classes?: string[];
  groups?: string[];
  class_name?: string;
  start_date?: string;
  end_date?: string;
  teachers?: Array<{ displayName?: string }>;
  teacherIds?: string[];
}

/** Appels oubliés du jour (GET /presences/structures/:id/registers/forgotten?startDate=&endDate=). */
export const getForgottenRegisters = async (structureId: string, startDate: string, endDate: string): Promise<ForgottenRegister[]> => {
  const url = `/presences/structures/${structureId}/registers/forgotten?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  return json<ForgottenRegister[]>(await fetch(url, base)).then((d) => d ?? []).catch(() => []);
};

/** Une déclaration d'absence saisie par un parent, à valider par la vie scolaire. */
export interface Statement {
  id?: number;
  student_id?: string;
  student?: { displayName?: string; name?: string };
  display_name?: string;
  start_at?: string;
  end_at?: string;
  description?: string;
  treated_at?: string | null;
  is_treated?: boolean;
  validator_id?: string | null;
}

/** Déclarations d'absence des parents (GET /presences/statements/absences). */
export const getStatements = async (structureId: string, startAt: string, endAt: string, isTreated?: boolean): Promise<Statement[]> => {
  let url = `/presences/statements/absences?structure_id=${structureId}&start_at=${encodeURIComponent(startAt)}&end_at=${encodeURIComponent(endAt)}`;
  if (typeof isTreated === 'boolean') url += `&is_treated=${isTreated}`;
  return json<{ all?: Statement[] } | Statement[]>(await fetch(url, base))
    .then((d) => (Array.isArray(d) ? d : d?.all ?? []))
    .catch(() => []);
};

// ── Régularisation des absences (événements) ────────────────────────────────────
/** Un événement d'absence aplati (issu de all[].student.day_history[].events[]). */
export interface EventItem {
  id: number;
  studentId: string;
  studentName: string;
  classeName: string;
  date: string;
  start_date?: string;
  end_date?: string;
  reason?: string | null;
  reason_id?: number | null;
  counsellor_regularisation?: boolean;
}

/** Structure imbriquée renvoyée par GET /presences/events. */
interface EventsResponse {
  all?: Array<{
    date?: string;
    student?: {
      id?: string;
      displayName?: string;
      classeName?: string;
      day_history?: Array<{ events?: Array<Record<string, unknown>> }>;
    };
  }>;
}

/**
 * Événements d'absence d'une structure, **aplatis** (un item par événement).
 * `regularized` filtre régularisés/non régularisés (undefined = tous).
 */
export const getEvents = async (structureId: string, startDate: string, endDate: string, regularized?: boolean): Promise<EventItem[]> => {
  let url = `/presences/events?structureId=${structureId}&startDate=${startDate}&endDate=${endDate}&eventType=1&page=0`;
  if (typeof regularized === 'boolean') url += `&regularized=${regularized}`;
  const data = await json<EventsResponse>(await fetch(url, base)).catch(() => ({ all: [] as EventsResponse['all'] }));
  const items: EventItem[] = [];
  for (const row of data.all ?? []) {
    const s = row.student;
    if (!s) continue;
    for (const day of s.day_history ?? []) {
      for (const ev of day.events ?? []) {
        const e = ev as Record<string, unknown>;
        if (e.type_id !== 1) continue; // absences uniquement
        items.push({
          id: Number(e.id),
          studentId: s.id ?? '',
          studentName: s.displayName ?? s.id ?? '',
          classeName: s.classeName ?? '',
          date: row.date ?? '',
          start_date: e.start_date as string | undefined,
          end_date: e.end_date as string | undefined,
          reason: (e.reason as string | null) ?? null,
          reason_id: (e.reason_id as number | null) ?? null,
          counsellor_regularisation: Boolean(e.counsellor_regularisation),
        });
      }
    }
  }
  return items;
};

/** Régularise (ou dé-régularise) des événements d'absence (PUT /presences/events/regularized). */
export const regularizeEvents = async (ids: number[], regularized: boolean): Promise<void> => {
  const res = await fetch(`/presences/events/regularized`, {
    ...base,
    method: 'PUT',
    headers: mutHeaders(),
    body: JSON.stringify({ events: ids.map((id) => ({ id })), regularized }),
  });
  if (!res.ok) throw new Error(String(res.status));
};

export const api = {
  getReasons, getActions, getDisciplines, getSettings,
  createReason, deleteReason,
  createAction, deleteAction,
  createDiscipline, deleteDiscipline,
  getStudents, getStudentAbsences, createAbsence,
  getCourses, getClasses, getClassStudents, createRegister, createEvent,
  getAlertSummary, getForgottenRegisters, getStatements,
  getEvents, regularizeEvents,
};
