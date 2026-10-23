import { describe, expect, it } from 'vitest';
import {
  addGroup, addStudent, applyStatuses, collectiveBody, collectiveListParams, emptyCollectiveForm, formFromCollective, isCollectiveValid, isMultiple,
  isPeriodValid, nbStudentIssues, nbStudentsSubmit, reasonRule, removeAudience, removeStudent, studentIssue, submitIds,
} from './collectiveAbsences';

const st = (id: string, extra = {}) => ({ id, displayName: `Élève ${id}`, ...extra });
const aud = (id: string, students: ReturnType<typeof st>[]) => ({ id, name: `Classe ${id}`, countStudents: students.length, students });

describe('collectiveAbsences', () => {
  it('filtre la liste par nom de classe', () => {
    expect(collectiveListParams('2026-10-01', '2026-10-22', ['6A', '6 B'], 1)).toBe('?startDate=2026-10-01 00:00:00&endDate=2026-10-22 23:59:59&audienceName=6A&audienceName=6%20B&page=1');
  });
  it('compte un élève présent dans deux classes une seule fois', () => {
    const list = [aud('c1', [st('e1'), st('e2')]), aud('c2', [st('e2'), st('e3')])];
    expect(isMultiple(list, 'c2', 'e2')).toBe(true);
    expect(isMultiple(list, 'c1', 'e2')).toBe(false);
    expect(nbStudentsSubmit(list)).toBe(3);
    expect(submitIds(list, 'c2', [])).toEqual(['e3']);
  });
  it('écarte les élèves déjà absents ou déjà rattachés', () => {
    const list = [aud('c1', [st('e1', { isAbsent: true }), st('e2'), st('e3', { isUpdated: true })])];
    expect(nbStudentsSubmit(list)).toBe(2);
    expect(nbStudentIssues(list)).toBe(2);
    expect(submitIds(list, 'c1', ['e3'])).toEqual(['e2']);
    expect(studentIssue(st('x', { isAbsent: true }))).toBe('Déjà absent sur la période');
    expect(studentIssue(st('x', { isUpdated: true }))).toBe('Modifiée individuellement');
    expect(studentIssue(st('x'))).toBe('');
  });
  it('construit le corps sans classe vide', () => {
    const f = { ...emptyCollectiveForm('2026-10-23'), reasonId: 2, comment: 'Sortie', audiences: [aud('c1', [st('e1'), st('e2', { isAbsent: true })]), aud('c2', [st('e3', { isAbsent: true })])] };
    expect(collectiveBody(f, [])).toEqual({
      startDate: '2026-10-23 08:00:00', endDate: '2026-10-23 17:00:00', counsellorRegularisation: false, reasonId: 2, comment: 'Sortie', audiences: [{ id: 'c1', studentIds: ['e1'] }],
    });
    expect(collectiveBody({ ...f, id: 9 }, []).id).toBe(9);
  });
  it('contrôle la période et la sélection', () => {
    const f = { ...emptyCollectiveForm('2026-10-23'), audiences: [aud('c1', [st('e1')])] };
    expect(isCollectiveValid(f)).toBe(true);
    expect(isCollectiveValid({ ...f, startTime: '18:00' })).toBe(false);
    expect(isPeriodValid({ ...f, endDate: '2026-10-22' })).toBe(false);
    expect(isCollectiveValid({ ...f, audiences: [] })).toBe(false);
    expect(isCollectiveValid({ ...f, audiences: [aud('c1', [st('e1', { isAbsent: true })])] })).toBe(false);
  });
  it('applique la règle du motif', () => {
    expect(reasonRule({ proving: true })).toEqual({ canRegularize: false, counsellorRegularisation: true });
    expect(reasonRule({ proving: false })).toEqual({ canRegularize: true, counsellorRegularisation: false });
    expect(reasonRule(null)).toEqual({ canRegularize: false, counsellorRegularisation: false });
  });
  it('ajoute et retire classes et élèves', () => {
    let l = addGroup([], { id: 'c1', name: '6A' }, [st('e1'), st('e2')]);
    l = addGroup(l, { id: 'c1', name: '6A' }, [st('e2'), st('e3')]);
    expect(l[0].students.map((s) => s.id)).toEqual(['e1', 'e2', 'e3']);
    l = addStudent(l, { id: 'c2', name: '6B', countStudents: 25 }, st('e9'));
    expect(l.map((a) => a.id)).toEqual(['c1', 'c2']);
    expect(addStudent(l, { id: 'c2', name: '6B' }, st('e9'))).toBe(l);
    expect(removeStudent(l, 'e9').map((a) => a.id)).toEqual(['c1']);
    expect(removeAudience(l, 'c1').map((a) => a.id)).toEqual(['c2']);
  });
  it('applique les états reçus du serveur', () => {
    const l = applyStatuses([aud('c1', [st('e1'), st('e2')])], [{ studentId: 'e2', isAbsent: true }]);
    expect(l[0].students.map((s) => !!s.isAbsent)).toEqual([false, true]);
  });
  it('remplit le formulaire d’édition', () => {
    const { form, loadedIds } = formFromCollective({ id: 4, startDate: '2026-10-23 08:00:00', endDate: '2026-10-24 17:30:00', reasonId: 1, comment: 'Voyage', audiences: [{ id: 'c1', name: '6A', students: [{ id: 'e1', displayName: 'Léa' }] }] }, [{ id: 1, proving: true }]);
    expect(form).toMatchObject({ id: 4, startDate: '2026-10-23', endDate: '2026-10-24', startTime: '08:00', endTime: '17:30', reasonId: 1, counsellorRegularisation: true, comment: 'Voyage' });
    expect(loadedIds).toEqual(['e1']);
  });
});
