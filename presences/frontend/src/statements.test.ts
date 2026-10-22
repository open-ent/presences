import { describe, expect, it } from 'vitest';
import { emptyStatementForm, isTreated, statementError, statementFormData, statementParams, statementPeriod, attachmentUrl } from './statements';

describe('statements', () => {
  it('masque les traitées par défaut, comme l’AngularJS', () => {
    const f = { structureId: 's1', start: '2026-10-15', end: '2026-10-22', studentIds: ['e1', 'e2'], includeTreated: false };
    expect(statementParams(f, 1)).toBe('?structure_id=s1&start_at=2026-10-15&end_at=2026-10-22%2023:59:59&student_id=e1&student_id=e2&is_treated=false&page=1');
    expect(statementParams({ ...f, includeTreated: true, studentIds: [] })).toBe('?structure_id=s1&start_at=2026-10-15&end_at=2026-10-22%2023:59:59');
  });
  it('reconnaît une déclaration traitée et l’URL de sa pièce jointe', () => {
    expect(isTreated({ id: 1, start_at: '', end_at: '', treated_at: '2026-10-20 10:00:00' })).toBe(true);
    expect(isTreated({ id: 1, start_at: '', end_at: '', treated_at: null })).toBe(false);
    expect(attachmentUrl({ id: 7, structure_id: 's1', attachment_id: 'abc', start_at: '', end_at: '' })).toBe('/presences/statements/absences/7/attachment/abc?structure_id=s1');
  });
  it('journée entière : bornes des créneaux de l’établissement', () => {
    const f = { ...emptyStatementForm('s1', 'e1', '2026-10-22'), fullDay: true };
    expect(statementPeriod(f, '08:00:00', '17:30:00')).toEqual({ start: '2026-10-22 08:00:00', end: '2026-10-22 17:30:00' });
    expect(statementPeriod({ ...f, fullDay: false, startTime: '09:15', endTime: '10:15' })).toEqual({ start: '2026-10-22 09:15:00', end: '2026-10-22 10:15:00' });
  });
  it('contrôle l’enfant, les dates passées et l’ordre des heures', () => {
    const base = emptyStatementForm('s1', 'e1', '2026-10-22');
    expect(statementError({ ...base, studentId: '' }, '2026-10-22')).toBe('student');
    expect(statementError({ ...base, startDate: '2026-10-21' }, '2026-10-22')).toBe('past');
    expect(statementError({ ...base, startTime: '10:00', endTime: '09:00' }, '2026-10-22')).toBe('period');
    expect(statementError(base, '2026-10-22')).toBeNull();
  });
  it('construit le formulaire multipart', () => {
    const file = new File(['x'], 'justificatif.pdf', { type: 'application/pdf' });
    const d = statementFormData({ ...emptyStatementForm('s1', 'e1', '2026-10-22'), description: 'Rendez-vous médical', file });
    expect(d.get('student_id')).toBe('e1');
    expect(d.get('start_at')).toBe('2026-10-22 08:00:00');
    expect(d.get('description')).toBe('Rendez-vous médical');
    expect((d.get('file') as File).name).toBe('justificatif.pdf');
    expect(statementFormData(emptyStatementForm('s1', 'e1', '2026-10-22')).has('file')).toBe(false);
  });
});
