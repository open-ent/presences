import type { Channel, MassmailingType, PrefetchStudent, SendBody, Waiting } from './api';

/** Catégorie de modèle selon le type d'événement (`MailTemplateCategory`). */
export function templateCategory(type: MassmailingType): string {
  if (type === 'LATENESS') return 'LATENESS';
  if (type === 'PUNISHMENT' || type === 'SANCTION') return 'PUNISHMENT_SANCTION';
  return 'ABSENCES';
}

/** Destinataires cochés par défaut : le responsable principal, sinon tous (un seul destinataire connu = celui-là). */
export function defaultRecipients(student: PrefetchStudent): string[] {
  const relatives = student.relative ?? [];
  const primary = relatives.filter((r) => r.primary);
  return (primary.length > 0 ? primary : relatives).map((r) => r.id);
}

/** Sélection initiale : tous les élèves, avec leurs destinataires par défaut. */
export function initialSelection(students: PrefetchStudent[]): Record<string, string[]> {
  return Object.fromEntries(students.map((s) => [s.id, defaultRecipients(s)]));
}

/** Nombre de messages qui partiront (un par destinataire coché). */
export function messageCount(selection: Record<string, string[]>): number {
  return Object.values(selection).reduce((n, ids) => n + ids.length, 0);
}

/** Élèves sans destinataire coché : écartés de l'envoi (le serveur ne veut que des élèves avec destinataire). */
export function recipientsOnly(selection: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(selection).filter(([, ids]) => ids.length > 0));
}

export const massmailedValue = (w: Waiting): boolean | null => (w === 'waiting' ? false : w === 'mailed' ? true : null);

/** Corps de l'envoi, à partir de ce qui est affiché (mêmes filtres que le préchargement, pour envoyer ce qui est compté). */
export function sendBody(p: {
  structureId: string;
  type: MassmailingType;
  templateId: number;
  startAt: number;
  start: string;
  end: string;
  waiting: Waiting;
  selection: Record<string, string[]>;
}): SendBody {
  return {
    event_types: [p.type],
    template: p.templateId,
    structure: p.structureId,
    no_reason: true,
    isMultiple: false,
    start_at: p.startAt,
    reasons: [],
    punishmentsTypes: [],
    sanctionsTypes: [],
    start: p.start,
    end: p.end,
    students: recipientsOnly(p.selection),
    massmailed: massmailedValue(p.waiting),
  };
}

export const channelLabel = (c: Channel): string => ({ MAIL: 'Courriel', SMS: 'SMS', PDF: 'Courrier (PDF)' })[c];
