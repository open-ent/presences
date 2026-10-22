// Client REST du module Incidents (incidents) — session ENT, même origine.
// Migration AngularJS -> React (CCTP 51C) : lecture des incidents et des punitions/sanctions.

import { protagonistesLabel } from './utils';
import { PunishmentForm, RawPunishment, createBody, fieldsSummary, processBody } from './punishments';

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
/** Un incident aplati (libellés résolus en clair) + champs bruts nécessaires au PUT complet. */
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
  /** Incident brut tel que renvoyé par l'API (le PUT valide un body complet). */
  raw: RawIncident;
}

/** Incident brut (sous-ensemble utile de GET /incidents/incidents). */
export interface RawIncident {
  id: number;
  owner?: { id: string };
  structure_id?: string;
  date?: string;
  selected_hour?: boolean;
  description?: string;
  created?: string;
  processed?: boolean;
  place_id?: number;
  partner_id?: number;
  type_id?: number;
  seriousness_id?: number;
  incident_type?: { label?: string } | null;
  place?: { label?: string } | null;
  partner?: { label?: string } | null;
  seriousness?: { label?: string } | null;
  protagonists?: Array<{ user_id?: string; type_id?: number; student?: { displayName?: string }; type?: { label?: string } }>;
}

/** Structure renvoyée par GET /incidents/incidents. */
interface IncidentsResponse {
  all?: RawIncident[];
}

/** Incidents de la structure, aplatis (GET /incidents/incidents). */
/** Une page de résultats : le serveur en sert 20 à la fois. */
export interface Paged<T> {
  items: T[];
  page: number;
  /** Une page suivante existe (la page courante est pleine). */
  hasNext: boolean;
}

export const PAGE_SIZE = 20;

export const getIncidents = async (structureId: string, startDate: string, endDate: string, page = 0): Promise<Paged<Incident>> => {
  const url = `/incidents/incidents?structureId=${structureId}&startDate=${startDate}&endDate=${endDate}&page=${page}`;
  const data = await json<IncidentsResponse>(await fetch(url, base));
  const items = (data.all ?? []).map((i) => ({
    id: i.id,
    date: i.date ?? '',
    description: i.description ?? '',
    processed: Boolean(i.processed),
    typeLabel: i.incident_type?.label ?? '',
    placeLabel: i.place?.label ?? '',
    partnerLabel: i.partner?.label ?? '',
    seriousnessLabel: i.seriousness?.label ?? '',
    protagonistes: protagonistesLabel(i.protagonists ?? []),
    raw: i,
  }));
  return { items, page, hasNext: (data.all ?? []).length >= PAGE_SIZE };
};

/** URL de l'export CSV des incidents (GET /incidents/incidents/export — téléchargement direct). */
export const incidentsExportUrl = (structureId: string, startDate: string, endDate: string): string =>
  `/incidents/incidents/export?structureId=${structureId}&startDate=${startDate}&endDate=${endDate}`;

// ── Référentiels (types, lieux, partenaires, gravités, types de protagoniste) ─────
/** Entrée de référentiel incidents (label + drapeau caché). */
export interface RefItem {
  id: number;
  label: string;
  hidden?: boolean;
}

const refList = async (url: string): Promise<RefItem[]> =>
  json<RefItem[]>(await fetch(url, base)).then((l) => (l ?? []).filter((x) => !x.hidden));

export const getIncidentTypes = (structureId: string) => refList(`/incidents/types?structureId=${structureId}`);
export const getPlaces = (structureId: string) => refList(`/incidents/places?structureId=${structureId}`);
export const getPartners = (structureId: string) => refList(`/incidents/partners?structureId=${structureId}`);
export const getSeriousnesses = (structureId: string) => refList(`/incidents/seriousnesses?structureId=${structureId}`);
export const getProtagonistTypes = (structureId: string) => refList(`/incidents/protagonists/type?structureId=${structureId}`);

// ── Annuaire élèves (recherche de protagonistes) ──────────────────────────────────
/** Élève de la structure (annuaire). */
export interface Student {
  id: string;
  displayName: string;
  classe?: string;
}

/** Élèves de la structure via l'annuaire (GET /directory/structure/:id/users, filtre Student). */
export const getStudents = async (structureId: string): Promise<Student[]> => {
  const users = await json<Array<{ id: string; displayName?: string; type?: string[] | string; classesNames?: string[] }>>(
    await fetch(`/directory/structure/${structureId}/users`, base),
  );
  return (users ?? [])
    .filter((u) => (Array.isArray(u.type) ? u.type.includes('Student') : u.type === 'Student'))
    .map((u) => ({ id: u.id, displayName: u.displayName ?? '', classe: u.classesNames?.[0] }));
};

/** Crée un incident (POST /incidents/incidents — schéma complet requis). */
export const createIncident = async (data: {
  ownerId: string;
  structureId: string;
  date: string; // ISO local 'YYYY-MM-DDTHH:mm:ss'
  description: string;
  placeId: number;
  partnerId: number;
  typeId: number;
  seriousnessId: number;
  students: Array<{ user_id: string; type_id: number }>;
}): Promise<void> => {
  const body = {
    owner: { id: data.ownerId },
    structure_id: data.structureId,
    date: data.date,
    selected_hour: false,
    description: data.description,
    created: data.date,
    processed: false,
    place_id: data.placeId,
    partner_id: data.partnerId,
    type_id: data.typeId,
    seriousness_id: data.seriousnessId,
    students: data.students,
  };
  const res = await fetch('/incidents/incidents', { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
};

// ── Punitions / sanctions ────────────────────────────────────────────────────────
/** Une punition/sanction aplatie. */
export interface Punishment {
  id: string;
  studentName: string;
  typeLabel: string;
  description: string;
  createdAt: string;
  processed: boolean;
  /** Détail lisible (échéance, créneaux, période). */
  details: string;
  /** Objet serveur complet, renvoyé tel quel lors d'une mise à jour. */
  raw: RawPunishment;
}

/** Punitions/sanctions de la structure (GET /incidents/punishments) ; `params` vient de `listParams`. */
export const getPunishments = async (params: string, page = 0): Promise<Paged<Punishment>> => {
  const data = await json<{ all?: RawPunishment[] }>(await fetch(`/incidents/punishments?${params}&page=${page}`, base));
  const items = (data.all ?? []).map((p) => ({
    id: p.id,
    studentName: p.student?.displayName ?? '',
    typeLabel: p.type?.label ?? '',
    description: p.description ?? '',
    createdAt: p.created_at ?? '',
    processed: Boolean(p.processed),
    details: fieldsSummary(p.fields),
    raw: p,
  }));
  return { items, page, hasNext: (data.all ?? []).length >= PAGE_SIZE };
};

/** Export CSV des punitions (GET /incidents/punishments/export, mêmes critères que la liste). */
export const punishmentsExportUrl = (params: string): string => `/incidents/punishments/export?${params}`;

/** Crée des punitions (une par élève) : POST /incidents/punishments. */
export const createPunishment = async (form: PunishmentForm): Promise<void> => {
  const res = await fetch('/incidents/punishments', { ...base, method: 'POST', headers: mutHeaders(), body: JSON.stringify(createBody(form)) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Marque une punition traitée / non traitée : PUT /incidents/punishments. */
export const setPunishmentProcessed = async (p: RawPunishment, processed: boolean): Promise<void> => {
  const res = await fetch('/incidents/punishments', { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(processBody(p, processed)) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Supprime une punition (ou toutes les retenues du même groupe) : DELETE /incidents/punishments. */
export const deletePunishment = async (p: RawPunishment): Promise<void> => {
  let url = `/incidents/punishments?structureId=${p.structure_id ?? ''}&id=${p.id}`;
  if (p.grouped_punishment_id) url += `&grouped_punishment_id=${p.grouped_punishment_id}`;
  const res = await fetch(url, { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

// ── Types de sanction (référentiel, pour information) ─────────────────────────────
/** Un type de sanction/punition. */
export interface PunishmentType {
  id: number;
  label: string;
  /** « PUNISHMENT » ou « SANCTION ». */
  type?: string;
  /** 1 travail, 2 retenue, 3 blâme, 4 exclusion. */
  punishment_category_id?: number;
  hidden?: boolean;
}

/** Types de punition/sanction de la structure (GET /incidents/punishments/type). */
export const getPunishmentTypes = async (structureId: string): Promise<PunishmentType[]> =>
  json<PunishmentType[]>(await fetch(`/incidents/punishments/type?structureId=${structureId}`, base));

/** Marque un incident comme traité / non traité (PUT /incidents/incidents/:id).
 *  Le backend valide le body contre le schéma COMPLET : renvoyer l'incident entier,
 *  protagonistes compris, avec seulement `processed` modifié. */
export const setIncidentProcessed = async (raw: RawIncident, processed: boolean): Promise<void> => {
  const body = {
    owner: { id: raw.owner?.id ?? '' },
    structure_id: raw.structure_id ?? '',
    date: raw.date ?? '',
    selected_hour: Boolean(raw.selected_hour),
    description: raw.description ?? '',
    created: raw.created ?? raw.date ?? '',
    processed,
    place_id: raw.place_id ?? 0,
    partner_id: raw.partner_id ?? 0,
    type_id: raw.type_id ?? 0,
    seriousness_id: raw.seriousness_id ?? 0,
    students: (raw.protagonists ?? []).map((p) => ({ user_id: p.user_id ?? '', type_id: p.type_id ?? 0 })),
  };
  const res = await fetch(`/incidents/incidents/${raw.id}`, { ...base, method: 'PUT', headers: mutHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
};

export const api = {
  getIncidents,
  getPunishments,
  punishmentsExportUrl,
  createPunishment,
  setPunishmentProcessed,
  deletePunishment,
  getPunishmentTypes,
  setIncidentProcessed,
  getIncidentTypes,
  getPlaces,
  getPartners,
  getSeriousnesses,
  getProtagonistTypes,
  getStudents,
  createIncident,
  incidentsExportUrl,
};
