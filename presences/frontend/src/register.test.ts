import { describe, expect, it } from 'vitest';

import { absenceBlocked, attenders, canNotify, EVENT, eventOf, groupStudents, historyClass, isCurrentSlot, isFutureCourse, nowOnDay, shiftDay, sqlDate, stateKey, summary, timeOf, withTime } from './register';

describe('formats de date du registre', () => {
  it('sqlDate normalise le format ISO', () => {
    expect(sqlDate('2026-10-22T08:00:00.000')).toBe('2026-10-22 08:00:00');
    expect(sqlDate('2026-10-22 08:00:00')).toBe('2026-10-22 08:00:00');
    expect(sqlDate(undefined)).toBe('');
  });
  it('timeOf et withTime', () => {
    expect(timeOf('2026-10-22 08:05:00')).toBe('08:05');
    expect(timeOf('illisible')).toBe('');
    expect(withTime('2026-10-22T08:00:00', '09:15')).toBe('2026-10-22 09:15:00');
  });
  it('nowOnDay : jour du registre, heure courante à la minute', () => {
    expect(nowOnDay('2026-10-22T08:00:00', new Date(2030, 0, 1, 9, 7, 45))).toBe('2026-10-22 09:07:00');
  });
  it('shiftDay franchit mois et année', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('événements d’un élève', () => {
  const s = (events: Array<{ id: number; type_id: number }>) => ({ id: 'x', name: 'N', events });
  it('eventOf cherche par type', () => {
    expect(eventOf(s([{ id: 1, type_id: 2 }]), EVENT.LATENESS)?.id).toBe(1);
    expect(eventOf(s([{ id: 1, type_id: 2 }]), EVENT.ABSENCE)).toBeUndefined();
    expect(eventOf({ id: 'x', name: 'N' }, EVENT.ABSENCE)).toBeUndefined();
  });
  it('summary compte chaque type', () => {
    const students = [s([{ id: 1, type_id: 1 }]), s([{ id: 2, type_id: 2 }, { id: 3, type_id: 4 }]), s([]), s([{ id: 4, type_id: 3 }])];
    expect(summary(students)).toEqual({ absent: 1, late: 1, departed: 1, remarks: 1 });
  });
  it('stateKey', () => {
    expect(stateKey(3)).toBe('done');
    expect(stateKey(2)).toBe('inProgress');
    expect(stateKey(1)).toBe('todo');
    expect(stateKey(null)).toBe('todo');
  });
});

const st = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, ...extra });

describe('appel : historique, groupes, dispenses', () => {
  it('historyClass retient l’événement le plus grave', () => {
    expect(historyClass([])).toBe('');
    expect(historyClass([{ type_id: 4 }, { type_id: 2 }])).toBe('lateness');
    expect(historyClass([{ type_id: 3 }, { type_id: 1 }, { type_id: 4 }])).toBe('absence');
    expect(historyClass([{ type_id: 99 }])).toBe('');
  });
  it('isCurrentSlot : recouvrement avec la durée du registre', () => {
    const slot = { start: '2026-10-23T08:00:00', end: '2026-10-23T09:00:00' };
    expect(isCurrentSlot(slot, '2026-10-23 08:00:00', '2026-10-23 09:00:00')).toBe(true);
    expect(isCurrentSlot(slot, '2026-10-23 09:00:00', '2026-10-23 10:00:00')).toBe(false);
    expect(isCurrentSlot(slot, '2026-10-23 08:30:00', '2026-10-23 10:00:00')).toBe(true);
  });
  it('groupStudents : un bloc sans titre, ou un bloc par groupe trié par nom', () => {
    const list = [st('1', 'Zoé', { group_name: 'B' }), st('2', 'Alice', { group_name: 'A' }), st('3', 'Bob', { group_name: 'B' })];
    expect(groupStudents(list, ['A']).map((g) => [g.name, g.students.map((s) => s.name)])).toEqual([[null, ['Alice', 'Bob', 'Zoé']]]);
    expect(groupStudents(list, ['A', 'B']).map((g) => [g.name, g.students.map((s) => s.name)])).toEqual([['B', ['Bob', 'Zoé']], ['A', ['Alice']]]);
  });
  it('absenceBlocked : dispense sans présence obligatoire, saisie par la vie scolaire', () => {
    const exempt = st('1', 'A', { exempted: true, exemptions: [{ subject_id: 'm1', attendance: false }] });
    expect(absenceBlocked(exempt, 'm1', false)).toBe(true);
    expect(absenceBlocked(exempt, 'm2', false)).toBe(false);
    expect(absenceBlocked(st('1', 'A', { exempted: true, exemptions: [{ recursive_id: 3, attendance: false }] }), 'm9', false)).toBe(true);
    expect(absenceBlocked(st('1', 'A', { exempted: true, exemptions: [{ subject_id: 'm1', attendance: true }] }), 'm1', false)).toBe(false);
    const byStaff = st('1', 'A', { events: [{ id: 1, type_id: 1, counsellor_input: true }] });
    expect(absenceBlocked(byStaff, 'm1', false)).toBe(true);
    expect(absenceBlocked(byStaff, 'm1', true)).toBe(false);
  });
  it('attenders et isFutureCourse', () => {
    expect(attenders([st('1', 'A', { events: [{ id: 1, type_id: 1 }] }), st('2', 'B')])).toEqual({ present: 1, total: 2 });
    const now = new Date('2026-10-23T08:00:00');
    expect(isFutureCourse('2026-10-23T08:14:00', now)).toBe(false);
    expect(isFutureCourse('2026-10-23T08:16:00', now)).toBe(true);
    expect(isFutureCourse(undefined, now)).toBe(true);
  });
});

describe('canNotify', () => {
  const now = new Date('2026-10-23T10:00:00');
  it('autorise un appel oublié du jour ou d’hier avec le droit', () => {
    expect(canNotify('2026-10-23T08:00:00', 1, true, now)).toBe(true);
    expect(canNotify('2026-10-22T16:00:00', 2, true, now)).toBe(true);
  });
  it('refuse sans droit, appel terminé, cours trop récent ou trop ancien', () => {
    expect(canNotify('2026-10-23T08:00:00', 1, false, now)).toBe(false);
    expect(canNotify('2026-10-23T08:00:00', 3, true, now)).toBe(false);
    expect(canNotify('2026-10-23T09:50:00', 1, true, now)).toBe(false);
    expect(canNotify('2026-10-21T08:00:00', 1, true, now)).toBe(false);
    expect(canNotify(undefined, 1, true, now)).toBe(false);
  });
});
