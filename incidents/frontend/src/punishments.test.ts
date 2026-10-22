import { describe, expect, it } from 'vitest';
import { createBody, emptyForm, fieldsSummary, formError, listParams, processBody } from './punishments';

const form = (over = {}) => ({ ...emptyForm('s1'), typeId: 4, categoryId: 1 as const, studentIds: ['e1'], ...over });

describe('punishments', () => {
  it('exige un type, un élève puis les champs de la catégorie', () => {
    expect(formError(emptyForm('s1'))).toBe('type');
    expect(formError(form({ studentIds: [] }))).toBe('students');
    expect(formError(form())).toBe('delay');
    expect(formError(form({ delayDate: '2026-10-30' }))).toBeNull();
  });
  it('vérifie les créneaux de retenue', () => {
    const base = { categoryId: 2 as const };
    expect(formError(form(base))).toBe('slots');
    expect(formError(form({ ...base, slots: [{ date: '2026-10-30', startTime: '14:00', endTime: '13:00', place: '' }] }))).toBe('slot-order');
    expect(formError(form({ ...base, slots: [{ date: '2026-10-30', startTime: '14:00', endTime: '15:00', place: 'B12' }] }))).toBeNull();
  });
  it('vérifie la période d’exclusion', () => {
    const base = { categoryId: 4 as const };
    expect(formError(form(base))).toBe('period');
    expect(formError(form({ ...base, excludeStart: '2026-11-02', excludeEnd: '2026-11-01' }))).toBe('period-order');
  });
  it('construit le corps de création selon la catégorie', () => {
    expect(createBody(form({ delayDate: '2026-10-30', instruction: 'Exercices 3 à 5' })).fields).toEqual({ delay_at: '2026-10-30 00:00:00', instruction: 'Exercices 3 à 5' });
    expect(createBody(form({ categoryId: 2, slots: [{ date: '2026-10-30', startTime: '14:00', endTime: '15:00', place: 'B12' }] })).fields).toEqual([{ start_at: '2026-10-30 14:00:00', end_at: '2026-10-30 15:00:00', place: 'B12' }]);
    expect(createBody(form({ categoryId: 4, excludeStart: '2026-11-02', excludeEnd: '2026-11-03', mandatoryPresence: true })).fields).toEqual({ start_at: '2026-11-02 00:00:00', end_at: '2026-11-03 23:59:59', mandatory_presence: true });
    expect(createBody(form({ categoryId: 3 })).fields).toEqual({});
    expect(createBody(form({ categoryId: 3 }))).toMatchObject({ structure_id: 's1', type_id: 4, student_ids: ['e1'] });
  });
  it('renvoie la punition complète avec le nouvel état traité', () => {
    const b = processBody({ id: 'p1', structure_id: 's1', fields: {}, type: { id: 4 }, owner: { id: 'o' }, student: { id: 'e1' }, grouped_punishment_id: 'g' }, true);
    expect(b).toMatchObject({ id: 'p1', type_id: 4, owner_id: 'o', student_id: 'e1', processed: true, grouped_punishment_id: 'g' });
  });
  it('résume les champs', () => {
    expect(fieldsSummary([{ start_at: '2026-10-30 14:00:00', end_at: '2026-10-30 15:00:00', place: 'B12' }])).toBe('30/10/2026 14:00–15:00 (B12)');
    expect(fieldsSummary({ delay_at: '2026-10-30 00:00:00', instruction: 'x' })).toBe('30/10/2026 — x');
    expect(fieldsSummary({})).toBe('');
  });
  it('construit les paramètres de liste', () => {
    expect(listParams('s1', '2026-09-01', '2026-10-01', 'not', [2, 3])).toBe('structure_id=s1&start_at=2026-09-01&end_at=2026-10-01&type_id=2&type_id=3&process=NOT_PROCESSED');
    expect(listParams('s1', 'a', 'b', 'all', [])).toBe('structure_id=s1&start_at=a&end_at=b');
  });
});

import { absenceStatus, anomalyStudents, formFromPunishment, updateBody } from './punishments';

describe('punishments (édition, absences, filtres)', () => {
  it('ajoute l’absence à la création d’une exclusion', () => {
    const f = { ...emptyForm('s1'), typeId: 5, categoryId: 4 as const, studentIds: ['e1'], excludeStart: '2026-11-02', excludeEnd: '2026-11-03', absence: { enabled: true, reasonId: 7, followed: false } };
    expect(createBody(f).absence).toEqual({ reason_id: 7, followed: false });
    expect(createBody({ ...f, absence: { ...f.absence, enabled: false } }).absence).toBeUndefined();
  });
  it('classe la situation d’un élève sur la période', () => {
    expect(absenceStatus([], '2026-11-02 00:00:00', '2026-11-03 23:59:59')).toBe('none');
    expect(absenceStatus([{ start_date: '2026-11-02T00:00:00', end_date: '2026-11-03 23:59:59' }], '2026-11-02 00:00:00', '2026-11-03 23:59:59')).toBe('matching');
    expect(absenceStatus([{ start_date: '2026-11-02 08:00:00', end_date: '2026-11-02 12:00:00' }], '2026-11-02 00:00:00', '2026-11-03 23:59:59')).toBe('anomaly');
    expect(anomalyStudents({ a: [], b: [{ start_date: 'x', end_date: 'y' }] })).toEqual(['b']);
  });
  it('remplit le formulaire d’une retenue avec son groupe et renvoie les identifiants des créneaux', () => {
    const mk = (id: string, day: string) => ({ id, grouped_punishment_id: 'g', structure_id: 's1', type: { id: 4, punishment_category_id: 2 }, owner: { id: 'o' }, student: { id: 'e1', displayName: 'Léa' }, fields: { start_at: `${day} 14:00:00`, end_at: `${day} 15:00:00`, place: 'B12' } });
    const f = formFromPunishment(mk('p2', '2026-11-05'), [mk('p2', '2026-11-05'), mk('p1', '2026-11-02')]);
    expect(f.slots.map((s) => s.id)).toEqual(['p1', 'p2']);
    const body = updateBody(f);
    expect(body).toMatchObject({ id: 'p2', grouped_punishment_id: 'g', owner_id: 'o', student_id: 'e1', type_id: 4 });
    expect((body.fields as Array<{ id?: string }>).map((x) => x.id)).toEqual(['p1', 'p2']);
  });
  it('remplit une exclusion et une consigne', () => {
    const ex = formFromPunishment({ id: 'p', structure_id: 's', type: { id: 5, punishment_category_id: 4 }, fields: { start_at: '2026-11-02 00:00:00', end_at: '2026-11-03 23:59:59', mandatory_presence: true } });
    expect([ex.excludeStart, ex.excludeEnd, ex.mandatoryPresence]).toEqual(['2026-11-02', '2026-11-03', true]);
    const du = formFromPunishment({ id: 'p', structure_id: 's', type: { id: 1, punishment_category_id: 1 }, fields: { delay_at: '2026-10-30 00:00:00', instruction: 'x' } });
    expect([du.delayDate, du.instruction]).toEqual(['2026-10-30', 'x']);
  });
  it('filtre par élève et classe', () => {
    expect(listParams('s', 'a', 'b', 'all', [], ['e1', 'e2'], ['c1'])).toBe('structure_id=s&start_at=a&end_at=b&student_id=e1&student_id=e2&group_id=c1');
  });
  it('rattache la punition à un incident', () => {
    expect(createBody({ ...form({ categoryId: 3 }), incidentId: 42 }).incident_id).toBe(42);
    expect(createBody(form({ categoryId: 3 })).incident_id).toBeUndefined();
  });
});
