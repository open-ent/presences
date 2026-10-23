// Client REST du module Présences (presences) — session ENT, même origine.
// Incrément 1 : lecture seule du paramétrage de la structure (motifs, actions, dispositifs, réglages).

import { nomComplet } from './utils';
import i18n from 'i18next';

import type { RegisterDetail } from './register';
import { normalizeReason } from './utils';

/** Motif d'absence de la structure. */
export interface Reason {
  id: number;
  structure_id?: string;
  label: string;
  proving?: boolean;
  default?: boolean;
  hidden?: boolean;
  /** 1 absence, 2 retard. */
  reason_type_id?: number;
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
  json<Reason[]>(await fetch(`/presences/reasons?structureId=${structureId}`, base)).then((list) =>
    (list ?? []).map((r) => normalizeReason(r, (key) => i18n.t(key, { ns: 'presences', defaultValue: key }))),
  );

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
/** Élève trouvé par la recherche : nom d'affichage et première classe. */
export interface StudentHit { id: string; displayName: string; classe?: string }

/**
 * Recherche d'élèves côté serveur (GET /presences/search/students), restreinte aux élèves que le compte peut voir
 * (un enseignant ne trouve que les siens). Remplace le téléchargement de l'annuaire complet.
 */
export const searchStudents = async (structureId: string, q: string): Promise<StudentHit[]> =>
  json<Array<{ id: string; displayName?: string; firstName?: string; lastName?: string; classesNames?: string[] }>>(
    await fetch(`/presences/search/students?structureId=${structureId}&q=${encodeURIComponent(q.trim())}&field=firstName&field=lastName`, base),
  ).then((arr) => (arr ?? []).map((u) => ({ id: u.id, displayName: u.displayName ?? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim(), classe: u.classesNames?.[0] })));

/** Absences d'un élève sur une période. */
export const getStudentAbsences = async (structureId: string, studentId: string, start: string, end: string): Promise<Absence[]> => {
  const url = `/presences/absences?structureId=${structureId}&startDate=${start}&endDate=${end}&studentId=${studentId}`;
  return json<{ all?: Absence[] } | Absence[]>(await fetch(url, base)).then((d) => (Array.isArray(d) ? d : d.all ?? []));
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
  register_state_id?: number | null;
  teachers?: Array<{ id: string; displayName?: string }>;
}

/** Cours d'une structure sur une journée (pour l'appel). */
export const getCourses = async (structureId: string, date: string, teacherId?: string): Promise<Course[]> => {
  let url = `/presences/courses?structure=${structureId}&start=${date}&end=${date}`;
  // Enseignant : ses cours seulement (le serveur lit `teacher`, comme l'AngularJS).
  if (teacherId) url += `&teacher=${encodeURIComponent(teacherId)}`;
  return json<Course[]>(await fetch(url, base));
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
  ).then((arr) => (arr ?? []).map((c) => ({ id: c.id, name: c.name })));

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
export const createRegister = async (course: Course, structureId: string, teacherIds: string[] = []): Promise<{ id: number }> =>
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
        teacherIds,
        split_slot: false,
      }),
    }),
  );

/** Corps d'un événement d'appel : `typeId` 1 absence, 2 retard, 3 départ, 4 remarque. */
export interface EventBody {
  registerId: number;
  studentId: string;
  typeId: number;
  startDate: string;
  endDate: string;
  comment?: string;
  /** Saisi par le personnel de vie scolaire (et non par l'enseignant). */
  counsellorInput?: boolean;
}

const eventPayload = (b: EventBody) => ({
  register_id: b.registerId,
  type_id: b.typeId,
  student_id: b.studentId,
  start_date: b.startDate,
  end_date: b.endDate,
  counsellor_input: b.counsellorInput ?? true,
  counsellor_regularisation: false,
  reason_id: null,
  ...(b.comment !== undefined ? { comment: b.comment } : {}),
});

/** Enregistre un événement d'appel et renvoie son identifiant. */
export const createEvent = async (body: EventBody): Promise<number> => {
  const res = await fetch(`/presences/events`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(eventPayload(body)) });
  if (!res.ok && res.status !== 201) throw new Error(String(res.status));
  const created = (await res.json().catch(() => ({}))) as { id?: number };
  return Number(created.id ?? 0);
};

/** Modifie un événement d'appel (heure d'un retard ou d'un départ, texte d'une remarque). */
export const updateEvent = async (id: number, body: EventBody): Promise<void> => {
  const res = await fetch(`/presences/events/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(eventPayload(body)) });
  if (!res.ok) throw new Error(String(res.status));
};

export const deleteEvent = async (id: number): Promise<void> => {
  const res = await fetch(`/presences/events/${id}`, { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

/** Registre complet : élèves du cours avec leurs événements, dispenses et absents du cours précédent. */
export const getRegister = async (id: number): Promise<RegisterDetail> => json<RegisterDetail>(await fetch(`/presences/registers/${id}`, base));

/** Avancement du registre : 1 à faire, 2 en cours (première saisie), 3 terminé (« Valider l'appel »). */
export const setRegisterStatus = async (id: number, stateId: number): Promise<void> => {
  const res = await fetch(`/presences/registers/${id}/status`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify({ state_id: stateId }) });
  if (!res.ok) throw new Error(String(res.status));
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
  json<AlertSummary>(await fetch(`/presences/structures/${structureId}/alerts/summary`, base));

import type { StudentAlert } from './alerts';

export interface AlertsPage { page: number; page_count: number; all: StudentAlert[] }

/** Alertes par élève (GET /presences/structures/:id/alerts) ; `params` vient de `alertParams`, page comprise. */
export const getAlerts = async (structureId: string, params: string): Promise<AlertsPage> => {
  const d = await json<Partial<AlertsPage> | null>(await fetch(`/presences/structures/${structureId}/alerts${params}`, base));
  return { page: d?.page ?? 0, page_count: d?.page_count ?? 1, all: d?.all ?? [] };
};

/** Remet à zéro les alertes choisies (DELETE /presences/structures/:id/alerts). */
export const resetAlerts = async (structureId: string, body: unknown): Promise<void> => {
  const res = await fetch(`/presences/structures/${structureId}/alerts`, { ...base, method: 'DELETE', headers: mutHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
};

import type { AudienceHit } from './alerts';

/**
 * Classes, groupes et regroupements dont le nom correspond. La recherche de groupes demande le droit de recherche : sans
 * lui, on retombe sur les classes de l'établissement filtrées par nom ; les regroupements sont facultatifs.
 */
export const searchAudiences = async (structureId: string, q: string): Promise<AudienceHit[]> => {
  const term = q.trim();
  let hits: AudienceHit[];
  const res = await fetch(`/presences/search/groups?structureId=${structureId}&q=${encodeURIComponent(term)}&field=name`, base);
  if (res.ok) {
    hits = ((await res.json().catch(() => [])) as Array<{ id: string; name: string }>).map((g) => ({ id: g.id, name: g.name }));
  } else {
    const lower = term.toLowerCase();
    hits = (await getClasses(structureId)).filter((c) => c.name.toLowerCase().includes(lower));
  }
  const gr = await fetch(`/presences/grouping/structure/${structureId}/list?searchValue=${encodeURIComponent(term.replace(/\s/g, '').toLowerCase())}`, base);
  if (gr.ok) {
    const groupings = (await gr.json().catch(() => [])) as Array<{ id: string; name: string; student_divisions?: Array<{ id: string; name: string }> }>;
    hits.push(...groupings.map((g) => ({ id: g.id, name: g.name, members: (g.student_divisions ?? []).map((d) => ({ id: d.id, name: d.name })) })));
  }
  return hits;
};

// ── Absences prévues (liste de la structure) ─────────────────────────────────────
import type { PlannedAbsence } from './plannedAbsences';

export interface PlannedPage { page: number; all: PlannedAbsence[] }

/** Absences de la structure (GET /presences/absences, paginé) ; `url` vient de `listUrl`. */
export const getPlannedAbsences = async (url: string): Promise<PlannedPage> => {
  const d = await json<{ page?: number; all?: PlannedAbsence[] } | PlannedAbsence[] | null>(await fetch(url, base));
  if (Array.isArray(d)) return { page: 0, all: d };
  return { page: d?.page ?? 0, all: d?.all ?? [] };
};

/** Repères du jour : élèves absents à la journée et internes absents. */
export interface AbsenceMarkers { nb_day_students?: number; nb_internals?: number }
export const getAbsenceMarkers = async (structureId: string, startAt: string, endAt: string): Promise<AbsenceMarkers> =>
  json<AbsenceMarkers>(await fetch(`/presences/structures/${structureId}/absences/markers?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`, base));

/** Change le motif d'absences (PUT /presences/absence/reason) ; null = sans motif. */
export const setAbsenceReason = async (ids: number[], reasonId: number | null): Promise<void> => {
  const res = await fetch('/presences/absence/reason', { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify({ ids, reasonId }) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Régularise (ou dé-régularise) des absences (PUT /presences/absence/regularized). */
export const regularizeAbsences = async (ids: number[], regularized: boolean): Promise<void> => {
  const res = await fetch('/presences/absence/regularized', { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify({ ids, regularized }) });
  if (!res.ok) throw new Error(String(res.status));
};

// ── Absences collectives ─────────────────────────────────────────────────────────
import type { CollectiveAbsence } from './collectiveAbsences';

export interface CollectivesPage { page: number; page_count: number; all: CollectiveAbsence[] }

/** Absences collectives (GET .../absences/collectives) ; `params` vient de `collectiveListParams`. */
export const getCollectives = async (structureId: string, params: string): Promise<CollectivesPage> => {
  const d = await json<Partial<CollectivesPage> | null>(await fetch(`/presences/structures/${structureId}/absences/collectives${params}`, base));
  return { page: d?.page ?? 0, page_count: d?.page_count ?? 1, all: d?.all ?? [] };
};

export const getCollective = async (structureId: string, id: number): Promise<CollectiveAbsence> =>
  json<CollectiveAbsence>(await fetch(`/presences/structures/${structureId}/absences/collectives/${id}`, base));

const send = async (url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<void> => {
  const res = await fetch(url, { ...base, method, headers: mutHeaders(), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!res.ok) throw new Error(String(res.status));
};

export const createCollective = (structureId: string, body: unknown) => send(`/presences/structures/${structureId}/absences/collectives`, 'POST', body);
export const updateCollective = (structureId: string, id: number, body: unknown) => send(`/presences/structures/${structureId}/absences/collectives/${id}`, 'PUT', body);
export const deleteCollective = (structureId: string, id: number) => send(`/presences/structures/${structureId}/absences/collectives/${id}`, 'DELETE');
/** Retire des élèves d'une absence collective déjà enregistrée. */
export const removeFromCollective = (structureId: string, id: number, studentIds: string[]) => send(`/presences/structures/${structureId}/absences/collectives/${id}/students`, 'PUT', { studentIds });

/** Quels élèves sont déjà absents (ou modifiés individuellement) sur la période. */
export const getCollectiveStatuses = async (structureId: string, body: { startDate: string; endDate: string; studentIds: string[]; collectiveId: number | null }): Promise<Array<{ studentId: string; isAbsent?: boolean; isUpdated?: boolean }>> => {
  const res = await fetch(`/presences/structures/${structureId}/absences/isAbsent`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(body) });
  const d = await json<{ all?: Array<{ studentId: string; isAbsent?: boolean; isUpdated?: boolean }> } | null>(res);
  return d?.all ?? [];
};

/** Résultat de la recherche globale : un élève ou une classe (avec la classe de l'élève). */
export interface GlobalHit { id: string; displayName: string; type: 'USER' | 'GROUP'; groupId?: string; groupName?: string; firstName?: string; lastName?: string }

/** Recherche d'élèves et de classes (GET /presences/search), comme la recherche globale de l'AngularJS. */
export const searchGlobal = async (structureId: string, q: string): Promise<GlobalHit[]> =>
  json<GlobalHit[]>(await fetch(`/presences/search?structureId=${structureId}&q=${encodeURIComponent(q.toLowerCase())}`, base)).then((a) => a ?? []);

/** Élèves d'une classe ou d'un groupe (GET /presences/users?groupId=&type=GROUP). */
export const getGroupMembers = async (groupId: string): Promise<Array<{ id: string; firstName?: string; lastName?: string }>> =>
  json<Array<{ id: string; firstName?: string; lastName?: string }>>(await fetch(`/presences/users?groupId=${groupId}&type=GROUP`, base)).then((a) => a ?? []);

// ── Registre mensuel ─────────────────────────────────────────────────────────────
import type { RegistryStudent } from './registry';

/** Registre du mois (GET /presences/registry) ; `url` vient de `registryUrl`. */
export const getRegistry = async (url: string): Promise<RegistryStudent[]> => json<RegistryStudent[]>(await fetch(url, base)).then((a) => a ?? []);

// ── Dispenses (liste complète, création, modification, suppression) ─────────────
import type { ExemptionForm, RawExemption } from './exemptions';
import { exemptionBody, exemptionDeleteUrl, exemptionEditUrl } from './exemptions';

export interface ExemptionsPage { page: number; pageCount: number; values: RawExemption[] }

/** Dispenses de la structure (GET /presences/exemptions) ; `params` vient de `exemptionParams`, page comprise. */
export const getExemptionsPage = async (params: string, page: number): Promise<ExemptionsPage> => {
  const d = await json<{ page_count?: number; values?: RawExemption[] } | null>(await fetch(`/presences/exemptions${params}`, base));
  return { page, pageCount: d?.page_count ?? 1, values: d?.values ?? [] };
};

/** Crée (POST) ou modifie (PUT) une dispense ponctuelle ou récurrente. */
export const saveExemption = async (form: ExemptionForm): Promise<void> => {
  const url = form.editing ? exemptionEditUrl(form.editing) : '/presences/exemptions';
  const res = await fetch(url, { ...base, method: form.editing ? 'PUT' : 'POST', headers: mutHeaders(), body: JSON.stringify(exemptionBody(form)) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Supprime une dispense ponctuelle ou récurrente. */
export const deleteExemption = async (e: RawExemption): Promise<void> => {
  const res = await fetch(exemptionDeleteUrl(e), { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

// ── Calendrier d'un élève ────────────────────────────────────────────────────────
import type { CalAbsence, CalCourse } from './studentCalendar';

export const getCalendarCourses = async (url: string): Promise<CalCourse[]> => json<CalCourse[]>(await fetch(url, base)).then((a) => a ?? []);
export const getCalendarAbsences = async (url: string): Promise<CalAbsence[]> => json<CalAbsence[]>(await fetch(url, base)).then((a) => a ?? []);

export interface CalPresence { id?: number; startDate?: string; endDate?: string; start_date?: string; end_date?: string; owner?: { displayName?: string } | string }
export const getCalendarPresences = async (url: string): Promise<CalPresence[]> => json<CalPresence[]>(await fetch(url, base)).then((a) => a ?? []);

/** Élèves de la classe de l'élève (navigation d'un élève à l'autre). */
export const getCalendarGroupStudents = async (groupId: string): Promise<Array<{ id: string; displayName: string }>> =>
  json<Array<{ id: string; displayName?: string; firstName?: string; lastName?: string }>>(await fetch(`/presences/calendar/groups/${groupId}/students`, base))
    .then((a) => (a ?? []).map((u) => ({ id: u.id, displayName: u.displayName ?? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() })));

/** Classe d'un élève (identifiant et nom) d'après le référentiel vie scolaire. */
export const getStudentClass = async (structureId: string, studentId: string): Promise<{ id: string; name?: string } | null> => {
  const res = await fetch(`/viescolaire/eleves?idUser=${studentId}&idStructure=${structureId}`, base);
  if (!res.ok) return null;
  const a = (await res.json().catch(() => [])) as Array<{ idClasse?: string; classeName?: string }>;
  return a?.[0]?.idClasse ? { id: a[0].idClasse, name: a[0].classeName } : null;
};

/** Modifie le motif d'une absence saisie (PUT /presences/absence/:id). */
export const updateAbsence = async (id: number, body: { structureId: string; owner: string; studentId: string; startDate: string; endDate: string; reasonId: number | null }): Promise<void> => {
  const res = await fetch(`/presences/absence/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify({ structure_id: body.structureId, owner: body.owner, student_id: body.studentId, start_date: body.startDate, end_date: body.endDate, reason_id: body.reasonId }) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Supprime une absence saisie (DELETE /presences/absence/:id). */
export const deleteAbsence = async (id: number): Promise<void> => {
  const res = await fetch(`/presences/absence/${id}`, { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

// ── Présences saisies (1er degré) : liste, création, modification, suppression ──
import type { PresenceForm, PresenceRecord } from './presenceList';
import { presenceBody } from './presenceList';

/** Présences (GET /presences/presences) ; `params` vient de `presenceParams`. */
export const getPresenceList = async (params: string): Promise<PresenceRecord[]> => json<PresenceRecord[]>(await fetch(`/presences/presences${params}`, base)).then((a) => a ?? []);

/** Enregistre une présence : création (POST) ou modification (PUT /presences/presence). */
export const savePresence = async (form: PresenceForm): Promise<void> => {
  const res = await fetch('/presences/presence', { ...base, method: form.id ? 'PUT' : 'POST', headers: mutHeaders(), body: JSON.stringify(presenceBody(form)) });
  if (!res.ok) throw new Error(String(res.status));
};

export const deletePresence = async (id: number): Promise<void> => {
  const res = await fetch(`/presences/presence?id=${id}`, { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

/** Personnel et enseignants dont le nom correspond (auteurs des présences). */
export const searchStaff = async (structureId: string, q: string): Promise<Array<{ id: string; displayName: string }>> => {
  const term = encodeURIComponent(q.trim().toLowerCase());
  const calls = ['Personnel', 'Teacher'].map(async (profile) => {
    const res = await fetch(`/presences/search/users?structureId=${structureId}&profile=${profile}&q=${term}&field=firstName&field=lastName`, base);
    return res.ok ? ((await res.json().catch(() => [])) as Array<{ id: string; displayName?: string; firstName?: string; lastName?: string }>) : [];
  });
  const all = (await Promise.all(calls)).flat();
  const seen = new Set<string>();
  return all.filter((u) => !seen.has(u.id) && seen.add(u.id)).map((u) => ({ id: u.id, displayName: u.displayName ?? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() }));
};

// ── Liste des appels (période, enseignants, classes, oublis, relance) ───────────
import type { ListedCourse } from './courseList';

/** Cours d'une période (GET /presences/courses) ; `url` vient de `coursesUrl`. */
export const getCourseList = async (url: string): Promise<ListedCourse[]> => json<ListedCourse[]>(await fetch(url, base)).then((a) => a ?? []);

/** Relance l'enseignant d'un appel oublié (POST /presences/courses/:id/notify). */
export const notifyCourse = async (course: ListedCourse): Promise<void> => {
  const res = await fetch(`/presences/courses/${encodeURIComponent(course.id)}/notify`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify({ start: course.startDate, end: course.endDate }) });
  if (!res.ok) throw new Error(String(res.status));
};

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
  return json<ForgottenRegister[]>(await fetch(url, base)).then((d) => d ?? []);
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
    ;
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
  /** 1 absence, 2 retard, 3 départ. */
  typeId?: number;
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
/** Une page de résultats : le serveur en sert 20 à la fois. */
export interface Paged<T> {
  items: T[];
  page: number;
  /** Une page suivante existe (la page courante est pleine). */
  hasNext: boolean;
}

export const PAGE_SIZE = 20;

/** Aplatit la réponse de GET /events ; `typeIds` retient les types voulus. */
const flattenEvents = (data: EventsResponse, typeIds: number[]): EventItem[] => {
  const items: EventItem[] = [];
  for (const row of data.all ?? []) {
    const s = row.student;
    if (!s) continue;
    for (const day of s.day_history ?? []) {
      for (const ev of day.events ?? []) {
        const e = ev as Record<string, unknown>;
        if (!typeIds.includes(Number(e.type_id))) continue;
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
          typeId: Number(e.type_id),
        });
      }
    }
  }
  return items;
};

export const getEventsPage = async (structureId: string, startDate: string, endDate: string, regularized?: boolean, page = 0): Promise<Paged<EventItem>> => {
  let url = `/presences/events?structureId=${structureId}&startDate=${startDate}&endDate=${endDate}&eventType=1&page=${page}`;
  if (typeof regularized === 'boolean') url += `&regularized=${regularized}`;
  const data = await json<EventsResponse>(await fetch(url, base));
  return { items: flattenEvents(data, [1]), page, hasNext: (data.all ?? []).length >= PAGE_SIZE };
};

/** Liste filtrée (types, régularisation, motifs) : `params` vient de `filterParams` (eventFilters.ts). */
export const getEventsFiltered = async (params: string, typeIds: number[], page = 0): Promise<Paged<EventItem>> => {
  const data = await json<EventsResponse>(await fetch(`/presences/events?${params}&page=${page}`, base));
  return { items: flattenEvents(data, typeIds), page, hasNext: (data.all ?? []).length >= PAGE_SIZE };
};

/** Change le motif d'événements d'absence ou de retard (PUT /presences/events/reason) ; null = sans motif. */
export const changeEventsReason = async (ids: number[], reasonId: number | null): Promise<void> => {
  const res = await fetch(`/presences/events/reason`, {
    ...base,
    method: 'PUT',
    headers: mutHeaders(),
    body: JSON.stringify({ events: ids.map((id) => ({ id })), reasonId }),
  });
  if (!res.ok) throw new Error(String(res.status));
};

/** Un créneau du profil horaire de la structure. */
export interface TimeSlot { id: string; name: string; startHour: string; endHour: string }

/** Créneaux horaires de la structure (GET /viescolaire/structures/:id/time-slot) ; vide si aucun profil. */
export const getTimeSlots = async (structureId: string): Promise<TimeSlot[]> => {
  const res = await fetch(`/viescolaire/structures/${structureId}/time-slot`, base);
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { slots?: TimeSlot[] } | null;
  return data?.slots ?? [];
};

/** Une action engagée sur un événement (historique). */
export interface EventAction { id?: number; action_id: number; label: string; comment?: string | null; created_date?: string; owner?: string; displayName?: string }

/** Historique des actions d'un événement (GET /presences/events/:id/actions). */
export const getEventActions = async (eventId: number): Promise<EventAction[]> =>
  json<EventAction[]>(await fetch(`/presences/events/${eventId}/actions`, base));

/** Engage une action sur un ou plusieurs événements (POST /presences/events/actions). */
export const createEventAction = async (eventIds: number[], actionId: number, owner: string, comment: string): Promise<void> => {
  const res = await fetch('/presences/events/actions', { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify({ eventId: eventIds, actionId, owner, comment }) });
  if (!res.ok) throw new Error(String(res.status));
};

// ── Déclarations d'absence (parents) ─────────────────────────────────────────────
import type { RawStatement } from './statements';

export interface StatementsPage { page: number; page_count: number; all: RawStatement[] }

/** Déclarations d'absence filtrées (`params` vient de `statementParams`, page comprise). */
export const getStatementsPage = async (params: string): Promise<StatementsPage> => {
  const d = await json<Partial<StatementsPage> | RawStatement[]>(await fetch(`/presences/statements/absences${params}`, base));
  if (Array.isArray(d)) return { page: 0, page_count: 1, all: d };
  return { page: d?.page ?? 0, page_count: d?.page_count ?? 1, all: d?.all ?? [] };
};

/** Marque une déclaration traitée / non traitée (PUT .../validate). */
export const validateStatement = async (id: number, isTreated: boolean): Promise<void> => {
  const res = await fetch(`/presences/statements/absences/${id}/validate`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify({ is_treated: isTreated }) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Dépose une déclaration (multipart ; avec pièce jointe l'adresse change). */
export const createStatement = async (data: FormData): Promise<void> => {
  const res = await fetch(`/presences/statements/absences${data.has('file') ? '/attachment' : ''}`, { ...base, method: 'POST', headers: xsrfHeader(), body: data });
  if (!res.ok) throw new Error(String(res.status));
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

// ── Dispenses (exemptions) ──────────────────────────────────────────────────────
/** Une dispense d'élève sur une matière (aplatie depuis values[]). */
export interface Exemption {
  id: number;
  studentName: string;
  className: string;
  subjectName: string;
  startDate: string;
  endDate: string;
  attendance: boolean;
  comment: string;
  type: string;
}

/** Structure renvoyée par GET /presences/exemptions. */
interface ExemptionsResponse {
  values?: Array<{
    exemption_id: number;
    start_date?: string;
    end_date?: string;
    attendance?: boolean;
    comment?: string;
    type?: string;
    subject?: { name?: string };
    student?: { firstName?: string; lastName?: string; className?: string; classeName?: string };
  }>;
}

/** Dispenses de la structure, aplaties (nom élève / classe / matière résolus). */
export const getExemptions = async (structureId: string, startDate: string, endDate: string, page = 0): Promise<Paged<Exemption>> => {
  const url = `/presences/exemptions?structure_id=${structureId}&start_date=${startDate}&end_date=${endDate}&page=${page}`;
  const data = await json<ExemptionsResponse>(await fetch(url, base));
  const items = (data.values ?? []).map((v) => {
    const st = v.student;
    return {
      id: v.exemption_id,
      studentName: nomComplet(st?.lastName, st?.firstName),
      className: st?.className ?? st?.classeName ?? '',
      subjectName: v.subject?.name ?? '',
      startDate: v.start_date ?? '',
      endDate: v.end_date ?? '',
      attendance: Boolean(v.attendance),
      comment: v.comment ?? '',
      type: v.type ?? '',
    };
  });
  return { items, page, hasNext: (data.values ?? []).length >= PAGE_SIZE };
};

/**
 * Tous les événements d'absence de la période (toutes les pages, plafonné à 25 pages) : pour les compteurs, qui ne
 * doivent pas se limiter aux 20 premières lignes.
 */
export const getEvents = async (structureId: string, startDate: string, endDate: string, regularized?: boolean): Promise<EventItem[]> => {
  const all: EventItem[] = [];
  for (let page = 0; page < 25; page++) {
    const res = await getEventsPage(structureId, startDate, endDate, regularized, page);
    all.push(...res.items);
    if (!res.hasNext) break;
  }
  return all;
};

/** Une matière (pour le sélecteur de dispense). */
export interface Subject {
  id: string;
  name: string;
}

/** Matières de la structure (via viescolaire). */
export const getSubjects = async (structureId: string): Promise<Subject[]> =>
  json<Array<{ id: string; name: string }>>(await fetch(`/viescolaire/matieres?idEtablissement=${structureId}`, base))
    .then((arr) => arr.map((m) => ({ id: m.id, name: m.name })).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })))
    ;

/** Crée une dispense ponctuelle (POST /presences/exemptions). */
export const createExemption = async (
  structureId: string,
  studentId: string,
  subjectId: string,
  startDate: string,
  endDate: string,
  attendance: boolean,
  comment: string,
): Promise<void> => {
  const res = await fetch(`/presences/exemptions`, {
    ...base,
    method: 'POST',
    headers: mutHeaders(),
    body: JSON.stringify({ structure_id: structureId, subject_id: subjectId, student_id: [studentId], start_date: startDate, end_date: endDate, attendance, comment }),
  });
  if (!res.ok) throw new Error(String(res.status));
};

/** Une « présence » saisie (élèves signalés présents sur un créneau). */
export interface PresenceItem {
  id?: number;
  startDate?: string;
  endDate?: string;
  owner?: { displayName?: string } | string;
  markers?: Array<{ student?: { displayName?: string } }>;
}

/** Présences saisies sur une période (GET /presences/presences). */
export const getPresences = async (structureId: string, startDate: string, endDate: string): Promise<PresenceItem[]> =>
  json<PresenceItem[]>(await fetch(`/presences/presences?structureId=${structureId}&startDate=${startDate}&endDate=${endDate}`, base));

// ── Suivi d'un élève (élève ou parent) ───────────────────────────────────────
/** Catégories d'événements d'un élève, comme l'IHM AngularJS (`NO_REASON`… côté serveur). */
export const STUDENT_EVENT_TYPES = ['NO_REASON', 'UNREGULARIZED', 'REGULARIZED', 'LATENESS', 'DEPARTURE'] as const;
export type StudentEventType = (typeof STUDENT_EVENT_TYPES)[number];

export interface StudentEvent {
  id?: number;
  start_date?: string;
  end_date?: string;
  reason?: { label?: string } | string | null;
  comment?: string | null;
}

export interface StudentEvents {
  all: Partial<Record<StudentEventType, StudentEvent[]>>;
  totals: Partial<Record<StudentEventType, number>>;
}

/** Événements d'un élève sur une période, par catégorie (`GET /presences/students/:id/events`). */
export const getStudentEvents = async (structureId: string, studentId: string, startAt: string, endAt: string): Promise<StudentEvents> => {
  const types = STUDENT_EVENT_TYPES.map((ty) => `&type=${ty}`).join('');
  const data = await json<Partial<StudentEvents>>(
    await fetch(`/presences/students/${studentId}/events?structure_id=${structureId}&start_at=${startAt}&end_at=${endAt}${types}`, base),
  );
  return { all: data.all ?? {}, totals: data.totals ?? {} };
};

/** Enfant d'un responsable (`GET /presences/children?relativeId=`). */
export interface Child {
  id: string;
  displayName: string;
  structureId?: string;
}

export const getChildren = async (relativeId: string): Promise<Child[]> =>
  json<Array<{ id: string; displayName?: string; firstName?: string; lastName?: string; structure?: { id?: string } }>>(
    await fetch(`/presences/children?relativeId=${relativeId}`, base),
  ).then((arr) =>
    (arr ?? []).map((c) => ({ id: c.id, displayName: c.displayName ?? `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim(), structureId: c.structure?.id })),
  );

// ── Calendrier élève : retard sans registre ouvert, carnet de correspondance oublié ─
export interface LatenessInput { studentId: string; startDate: string; endDate: string; reasonId: number | null; comment: string; registerId?: number | null }

const latenessPayload = (b: LatenessInput) => ({
  start_date: b.startDate, end_date: b.endDate, student_id: b.studentId, comment: b.comment, register_id: b.registerId ?? -1, type_id: 2, reason_id: b.reasonId,
});

/** Retard saisi depuis le calendrier : le serveur retrouve le registre du cours (`register_id` = -1). */
export const createLateness = async (structureId: string, b: LatenessInput): Promise<void> => {
  const res = await fetch(`/presences/events/${structureId}/lateness`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(latenessPayload(b)) });
  if (!res.ok && res.status !== 201) throw new Error(String(res.status));
};

export const updateLateness = async (id: number, b: LatenessInput): Promise<void> => {
  const res = await fetch(`/presences/events/${id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(latenessPayload(b)) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Nombre de carnets oubliés d'un élève et seuil d'alerte (GET /presences/structures/:id/students/:id/alerts). */
export const getStudentNotebookCount = async (structureId: string, studentId: string): Promise<{ count: number; threshold: number }> => {
  const d = await json<{ count?: number; threshold?: number } | null>(await fetch(`/presences/structures/${structureId}/students/${studentId}/alerts?type=FORGOTTEN_NOTEBOOK`, base));
  return { count: d?.count ?? 0, threshold: d?.threshold ?? 0 };
};

export const resetStudentNotebookCount = async (structureId: string, studentId: string): Promise<void> => {
  const res = await fetch(`/presences/structures/${structureId}/students/${studentId}/alerts/reset?type=FORGOTTEN_NOTEBOOK`, { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

export const createForgottenNotebook = async (structureId: string, studentId: string, date: string): Promise<void> => {
  const res = await fetch(`/presences/forgotten/notebook`, { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify({ studentId, structureId, date }) });
  if (!res.ok && res.status !== 201) throw new Error(String(res.status));
};

export const api = {
  createLateness, updateLateness, getStudentNotebookCount, resetStudentNotebookCount, createForgottenNotebook,
  getReasons, getActions, getDisciplines, getSettings,
  createReason, deleteReason,
  createAction, deleteAction,
  createDiscipline, deleteDiscipline,
  searchStudents, getStudentAbsences, createAbsence,
  getCourses, getClasses, getClassStudents, createRegister, createEvent, updateEvent, deleteEvent, getRegister, setRegisterStatus,
  getCourseList, notifyCourse, getPresenceList, savePresence, deletePresence, searchStaff, getCalendarCourses, getCalendarAbsences, getCalendarPresences, getCalendarGroupStudents, getStudentClass, updateAbsence, deleteAbsence, getRegistry, getCollectives, getCollective, createCollective, updateCollective, deleteCollective, removeFromCollective, getCollectiveStatuses, searchGlobal, getGroupMembers,
  getPlannedAbsences, getAbsenceMarkers, setAbsenceReason, regularizeAbsences, getAlertSummary, searchAudiences, getAlerts, resetAlerts, getForgottenRegisters, getStatements,
  getStatementsPage, validateStatement, createStatement, getEvents, getEventsPage, getEventsFiltered, getTimeSlots, getEventActions, createEventAction, changeEventsReason, regularizeEvents,
  getExemptions, createExemption, getExemptionsPage, saveExemption, deleteExemption, getSubjects,
  getPresences, getStudentEvents, getChildren,
};
