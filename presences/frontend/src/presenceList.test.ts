import { describe, expect, it } from 'vitest';
import { addStudents, emptyPresenceForm, formFromPresence, groupByDay, presenceBody, presenceError, presenceParams, studentsLabel } from './presenceList';

const f = { structureId: 's1', start: '2026-09-23', end: '2026-10-23', studentIds: ['e1'], ownerIds: ['o1'], audienceIds: ['c1'], mine: false };
const rec = (id: number, start: string, extra = {}) => ({ id, structureId: 's1', startDate: start, endDate: start.replace(/ \d\d:\d\d/, ' 10:00'), discipline: { id: 3, label: 'EPS' }, owner: { id: 'o1', displayName: 'PROF' }, markedStudents: [{ student: { id: 'e1', displayName: 'Léa', classeName: '6A' }, comment: 'RAS' }], ...extra });

describe('presenceList', () => {
  it('construit les paramètres, avec « mes présences »', () => {
    expect(presenceParams(f, 'me')).toBe('?structureId=s1&startDate=2026-09-23&endDate=2026-10-23&studentId=e1&ownerId=o1&audienceId=c1');
    expect(presenceParams({ ...f, mine: true }, 'me')).toContain('&ownerId=o1&ownerId=me');
    expect(presenceParams({ ...f, mine: true, ownerIds: ['me'] }, 'me').match(/ownerId=me/g)).toHaveLength(1);
  });
  it('regroupe par jour, récents d’abord, heures croissantes', () => {
    const g = groupByDay([rec(1, '2026-10-20 09:00:00'), rec(2, '2026-10-21 08:00:00'), rec(3, '2026-10-20 08:00:00')]);
    expect(g.map((x) => x.day)).toEqual(['2026-10-21', '2026-10-20']);
    expect(g[1].items.map((p) => p.id)).toEqual([3, 1]);
    expect(studentsLabel(1)).toBe('1 élève');
    expect(studentsLabel(3)).toBe('3 élèves');
  });
  it('contrôle le formulaire', () => {
    const base = { ...emptyPresenceForm('s1', '2026-10-23', { id: 'o', displayName: 'P' }), startTime: '08:00', endTime: '09:00', disciplineId: 3, students: [{ id: 'e1', displayName: 'Léa', comment: '' }] };
    expect(presenceError(emptyPresenceForm('s1', '2026-10-23', { id: 'o', displayName: 'P' }))).toBe('discipline');
    expect(presenceError({ ...base, students: [] })).toBe('students');
    expect(presenceError({ ...base, endTime: '07:00' })).toBe('times');
    expect(presenceError({ ...base, startTime: '' })).toBe('times');
    expect(presenceError(base)).toBeNull();
  });
  it('construit les corps de création et de modification', () => {
    const base = { ...emptyPresenceForm('s1', '2026-10-23', { id: 'o', displayName: 'P' }), startTime: '08:00', endTime: '09:00', disciplineId: 3, students: [{ id: 'e1', displayName: 'Léa', comment: 'RAS' }] };
    expect(presenceBody(base)).toEqual({ structureId: 's1', startDate: '2026-10-23 08:00:00', endDate: '2026-10-23 09:00:00', disciplineId: 3, markedStudents: [{ studentId: 'e1', comment: 'RAS' }] });
    expect(presenceBody({ ...base, id: 9 }).id).toBe(9);
  });
  it('remplit la modification et ajoute les élèves sans doublon', () => {
    const form = formFromPresence(rec(5, '2026-10-20 08:00:00'));
    expect(form).toMatchObject({ id: 5, date: '2026-10-20', startTime: '08:00', endTime: '10:00', disciplineId: 3, owner: { id: 'o1' } });
    expect(form.students).toEqual([{ id: 'e1', displayName: 'Léa', classeName: '6A', comment: 'RAS' }]);
    expect(addStudents(form.students, [{ id: 'e1', displayName: 'Léa', comment: '' }, { id: 'e2', displayName: 'Paul', comment: '' }]).map((s) => s.id)).toEqual(['e1', 'e2']);
  });
});
