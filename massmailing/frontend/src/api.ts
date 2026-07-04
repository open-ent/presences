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

const period = (structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string) =>
  `structure=${structureId}&type=${type}&start_at=${startAt}&start_date=${startDate}&end_date=${endDate}`;

/** Compteur d'événements à publiposter par type (GET /massmailings/status). */
export const getStatus = async (structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string): Promise<number> => {
  const data = await json<Record<string, number>>(
    await fetch(`/massmailing/massmailings/status?${period(structureId, type, startAt, startDate, endDate)}`, base),
  ).catch(() => ({}) as Record<string, number>);
  return data[type] ?? 0;
};

/** Élève à publiposter (préchargement par canal). */
export interface PrefetchStudent {
  id: string;
  displayName?: string;
  className?: string;
  count?: Record<string, number>;
}

/** Préchargement du publipostage pour un canal (GET /massmailings/prefetch/:mailingType). */
export interface Prefetch {
  type: string;
  counts: { anomalies: number; students: number; massmailing: number };
  students: PrefetchStudent[];
}

export const getPrefetch = async (mailingType: 'MAIL' | 'PDF' | 'SMS', structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string): Promise<Prefetch> =>
  json<Prefetch>(
    await fetch(`/massmailing/massmailings/prefetch/${mailingType}?${period(structureId, type, startAt, startDate, endDate)}`, base),
  ).catch(() => ({ type: mailingType, counts: { anomalies: 0, students: 0, massmailing: 0 }, students: [] }));

/** Anomalie de publipostage (élève sans coordonnées valides pour un canal). */
export interface Anomaly {
  id: string;
  displayName?: string;
  className?: string;
  bug?: Record<string, boolean>;
  count?: Record<string, number>;
}

/** Élèves en anomalie (GET /massmailings/anomalies). */
export const getAnomalies = async (structureId: string, type: MassmailingType, startAt: number, startDate: string, endDate: string): Promise<Anomaly[]> =>
  json<Anomaly[]>(await fetch(`/massmailing/massmailings/anomalies?${period(structureId, type, startAt, startDate, endDate)}`, base)).catch(() => []);

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
  ).catch(() => ({ page: 0, page_count: 0, all: [] }));

export const api = { getStatus, getPrefetch, getAnomalies, getMailings };
