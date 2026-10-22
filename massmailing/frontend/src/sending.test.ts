import { describe, expect, it } from 'vitest';

import { defaultRecipients, initialSelection, messageCount, recipientsOnly, sendBody, templateCategory } from './sending';

const student = (id: string, relative: Array<{ id: string; primary?: boolean }>) => ({ id, relative });

describe('envoi du publipostage', () => {
  it('catégorie de modèle selon le type d’événement', () => {
    expect(templateCategory('LATENESS')).toBe('LATENESS');
    expect(templateCategory('PUNISHMENT')).toBe('PUNISHMENT_SANCTION');
    expect(templateCategory('SANCTION')).toBe('PUNISHMENT_SANCTION');
    expect(templateCategory('UNREGULARIZED')).toBe('ABSENCES');
    expect(templateCategory('NO_REASON')).toBe('ABSENCES');
  });
  it('destinataires par défaut : le principal, sinon tous', () => {
    expect(defaultRecipients(student('e1', [{ id: 'a' }, { id: 'b', primary: true }]))).toEqual(['b']);
    expect(defaultRecipients(student('e2', [{ id: 'a' }, { id: 'b' }]))).toEqual(['a', 'b']);
    expect(defaultRecipients(student('e3', []))).toEqual([]);
  });
  it('sélection, compteur et élèves sans destinataire écartés', () => {
    const sel = initialSelection([student('e1', [{ id: 'a', primary: true }]), student('e3', [])]);
    expect(sel).toEqual({ e1: ['a'], e3: [] });
    expect(messageCount({ ...sel, e2: ['x', 'y'] })).toBe(3);
    expect(recipientsOnly(sel)).toEqual({ e1: ['a'] });
  });
  it('corps de l’envoi : mêmes filtres que le préchargement', () => {
    const body = sendBody({ structureId: 's', type: 'LATENESS', templateId: 7, startAt: 3, start: '2026-09-01', end: '2027-08-31', waiting: 'waiting', selection: { e1: ['a'], e2: [] } });
    expect(body).toMatchObject({ event_types: ['LATENESS'], template: 7, structure: 's', start_at: 3, massmailed: false, reasons: [], students: { e1: ['a'] } });
    expect(sendBody({ ...{ structureId: 's', type: 'NO_REASON' as const, templateId: 1, startAt: 1, start: 'a', end: 'b', selection: {} }, waiting: 'all' }).massmailed).toBeNull();
    expect(sendBody({ structureId: 's', type: 'NO_REASON', templateId: 1, startAt: 1, start: 'a', end: 'b', selection: {}, waiting: 'mailed' }).massmailed).toBe(true);
  });
});
