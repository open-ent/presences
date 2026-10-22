// Client REST du module Publipostage (massmailing) — session ENT, même origine.
// Migration AngularJS -> React (CCTP 51C) : statuts, élèves à contacter, anomalies, historique.

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const base = { credentials: 'include' as const };

/** Types d'événement publipostables (enum backend MassmailingType). */
export const MASSMAILING_TYPES = ['UNREGULARIZED', 'REGULARIZED', 'LATENESS', 'PUNISHMENT', 'SANCTION', 'NO_REASON'] as const;
export type MassmailingType = (typeof MASSMAILING_TYPES)[number];

/** Événements à publiposter : en attente (jamais publipostés), déjà publipostés, ou tous. */
export type Waiting = 'waiting' | 'mailed' | 'all';

/** Paramètre serveur `massmailed` : `false` = en attente, `true` = déjà publipostés, absent = tous. */
export const massmailedParam = (w: Waiting): string => (w === 'waiting' ? '&massmailed=false' : w === 'mailed' ? '&massmailed=true' : '');

const period = (structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string, waiting: Waiting = 'waiting') =>
  `structure=${structureId}&type=${type}&start_at=${startAt}&start_date=${startDate}&end_date=${endDate}${massmailedParam(waiting)}`;

/** Compteur d'événements à publiposter par type (GET /massmailings/status). */
export const getStatus = async (structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string, waiting: Waiting = 'waiting'): Promise<number> => {
  const data = await json<Record<string, number>>(
    await fetch(`/massmailing/massmailings/status?${period(structureId, type, startAt, startDate, endDate, waiting)}`, base),
  );
  return data[type] ?? 0;
};

/** Élève à publiposter (préchargement par canal). */
export interface PrefetchStudent {
  id: string;
  displayName?: string;
  className?: string;
  count?: Record<string, number>;
  /** Destinataires (responsables) de l'élève pour ce canal. */
  relative?: Relative[];
}

export interface Relative {
  id: string;
  displayName?: string;
  /** Adresse électronique ou numéro, selon le canal. */
  contact?: string;
  address?: string;
  primary?: boolean;
}

/** Préchargement du publipostage pour un canal (GET /massmailings/prefetch/:mailingType). */
export interface Prefetch {
  type: string;
  counts: { anomalies: number; students: number; massmailing: number };
  students: PrefetchStudent[];
}

export const getPrefetch = async (mailingType: 'MAIL' | 'PDF' | 'SMS', structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string, waiting: Waiting = 'waiting'): Promise<Prefetch> =>
  json<Prefetch>(
    await fetch(`/massmailing/massmailings/prefetch/${mailingType}?${period(structureId, type, startAt, startDate, endDate, waiting)}`, base),
  );

/** Anomalie de publipostage (élève sans coordonnées valides pour un canal). */
export interface Anomaly {
  id: string;
  displayName?: string;
  className?: string;
  bug?: Record<string, boolean>;
  count?: Record<string, number>;
}

/** Élèves en anomalie (GET /massmailings/anomalies). */
export const getAnomalies = async (structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string, waiting: Waiting = 'waiting'): Promise<Anomaly[]> =>
  json<Anomaly[]>(await fetch(`/massmailing/massmailings/anomalies?${period(structureId, type, startAt, startDate, endDate, waiting)}`, base));

/** Publipostage passé (historique). */
export interface Mailing {
  id?: number;
  type?: string;
  event_types?: string[];
  created?: string;
  owner?: { displayName?: string } | string;
  student?: { name?: string; className?: string };
  recipient?: { name?: string; contact?: string };
  content?: string;
}

interface MailingsResponse {
  page: number;
  page_count: number;
  all: Mailing[];
}

/** Historique des publipostages (GET /mailings). */
export const getMailings = async (structureId: string, start: string, end: string, page = 0): Promise<MailingsResponse> =>
  json<MailingsResponse>(
    await fetch(`/massmailing/mailings?structure=${structureId}&start=${start}&end=${end}&page=${page}`, base),
  );

/** Modèle de courrier (GET /settings/templates/:type). */
export interface Template {
  id: number;
  name: string;
  content?: string;
  category?: string;
}

export const getTemplates = async (mailingType: Channel, structureId: string, category: string): Promise<Template[]> =>
  (await json<Template[]>(await fetch(`/massmailing/settings/templates/${mailingType}?structure=${structureId}&category=${category}`, base))) ?? [];

/** Canaux d'envoi : courriel, SMS, courrier PDF. */
export type Channel = 'MAIL' | 'SMS' | 'PDF';

/** Corps de `POST /massmailings/:canal` (mêmes clés que l'IHM AngularJS). */
export interface SendBody {
  event_types: string[];
  template: number;
  structure: string;
  no_reason: boolean;
  isMultiple: boolean;
  start_at: number;
  reasons: number[];
  punishmentsTypes: number[];
  sanctionsTypes: number[];
  start: string;
  end: string;
  /** élève → identifiants des responsables destinataires. */
  students: Record<string, string[]>;
  /** `false` = en attente seulement, `true` = déjà publipostés, `null` = tous. */
  massmailed: boolean | null;
}

/** Lance le publipostage. Courriel et SMS partent en tâche de fond (202) ; le courrier renvoie le PDF à télécharger. */
export const sendMassmailing = async (channel: Channel, body: SendBody): Promise<{ file?: Blob; fileName?: string }> => {
  const res = await fetch(`/massmailing/massmailings/${channel}`, {
    ...base,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(channel === 'PDF' ? { Accept: 'application/pdf' } : {}), ...xsrf() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  if (channel !== 'PDF') return {};
  const disposition = res.headers.get('content-disposition') ?? '';
  return { file: await res.blob(), fileName: (disposition.split('filename=')[1] ?? 'publipostage.pdf').replace(/"/g, '') };
};

function xsrf(): Record<string, string> {
  const m = /(?:^|; )XSRF-TOKEN=([^;]*)/.exec(document.cookie);
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

export const api = { getStatus, getPrefetch, getAnomalies, getMailings, getTemplates, sendMassmailing };
