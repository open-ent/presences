import { useEdificeClient } from '@open-ent/react';
import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { dateFr } from '../utils';

/**
 * Dispenses (exemptions) — parité IHM AngularJS : liste des dispenses de la structure
 * (GET /exemptions) et création d'une dispense ponctuelle (POST /exemptions).
 * Élève / matière / classe résolus en clair.
 */
export function Dispenses() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';

  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');

  const exemptionsQuery = useQuery({
    queryKey: ['pres', 'exemptions', structureId, start, end],
    queryFn: () => api.getExemptions(structureId, start, end),
    enabled: !!structureId,
  });
  const studentsQuery = useQuery({ queryKey: ['pres', 'students', structureId], queryFn: () => api.getStudents(structureId), enabled: !!structureId });
  const subjectsQuery = useQuery({ queryKey: ['pres', 'subjects', structureId], queryFn: () => api.getSubjects(structureId), enabled: !!structureId });

  const exemptions = exemptionsQuery.data ?? [];

  // Formulaire de création
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [exStart, setExStart] = useState('2026-01-05');
  const [exEnd, setExEnd] = useState('2026-06-30');
  const [attendance, setAttendance] = useState(false);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'exemptions', structureId] });
  const createMut = useMutation({
    mutationFn: () => api.createExemption(structureId, studentId, subjectId, exStart, exEnd, attendance, comment.trim()),
    onSuccess: () => { setComment(''); setFormError(''); invalidate(); },
    onError: () => setFormError(t('presences.exemption.error', { defaultValue: 'La création de la dispense a échoué.' })),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!studentId || !subjectId || !exStart || !exEnd) {
      setFormError(t('presences.exemption.required', { defaultValue: 'Élève, matière et dates sont obligatoires.' }));
      return;
    }
    setFormError('');
    createMut.mutate();
  };

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('presences.title', { defaultValue: 'Présences' })}</h1>
        <div className="alert alert-info" role="alert">
          {t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('presences.exemptions.title', { defaultValue: 'Dispenses' })}</h1>

      {/* Création d'une dispense */}
      <section className="card p-16 mb-24">
        <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.exemption.new', { defaultValue: 'Nouvelle dispense' })}</h2>
        <form onSubmit={onCreate} className="d-flex flex-column gap-12">
          <div className="d-flex gap-12 flex-wrap">
            <div style={{ minWidth: 240 }} className="flex-grow-1">
              <label htmlFor="ex-student" className="form-label">{t('presences.student', { defaultValue: 'Élève' })}</label>
              <select id="ex-student" className="form-select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">{t('presences.choose', { defaultValue: 'Choisir…' })}</option>
                {(studentsQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 240 }} className="flex-grow-1">
              <label htmlFor="ex-subject" className="form-label">{t('presences.subject', { defaultValue: 'Matière' })}</label>
              <select id="ex-subject" className="form-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">{t('presences.choose', { defaultValue: 'Choisir…' })}</option>
                {(subjectsQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="d-flex gap-12 flex-wrap align-items-end">
            <div>
              <label htmlFor="ex-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
              <input id="ex-start" type="date" className="form-control" value={exStart} onChange={(e) => setExStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ex-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
              <input id="ex-end" type="date" className="form-control" value={exEnd} onChange={(e) => setExEnd(e.target.value)} />
            </div>
            <div className="flex-grow-1" style={{ minWidth: 220 }}>
              <label htmlFor="ex-comment" className="form-label">{t('presences.comment', { defaultValue: 'Motif' })}</label>
              <input id="ex-comment" className="form-control" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div className="form-check" style={{ paddingBottom: 8 }}>
              <input id="ex-att" type="checkbox" className="form-check-input" checked={attendance} onChange={(e) => setAttendance(e.target.checked)} />
              <label htmlFor="ex-att" className="form-check-label">{t('presences.exemption.attendance', { defaultValue: 'Présence obligatoire' })}</label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{t('presences.exemption.add', { defaultValue: 'Créer' })}</button>
          </div>
          {formError && <div className="alert alert-warning mb-0" role="alert">{formError}</div>}
        </form>
      </section>

      {/* Filtre période + liste */}
      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="ex-flt-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="ex-flt-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ex-flt-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="ex-flt-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <h2 style={{ fontSize: 18 }} className="mb-12">
        {t('presences.exemptions.list', { defaultValue: 'Dispenses' })} <span className="text-muted" style={{ fontSize: 14 }}>({exemptions.length})</span>
      </h2>
      {exemptionsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!exemptionsQuery.isLoading && exemptions.length === 0 && (
        <p className="text-muted">{t('presences.exemptions.empty', { defaultValue: 'Aucune dispense sur la période.' })}</p>
      )}
      {exemptions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('presences.student', { defaultValue: 'Élève' })}</th>
                <th>{t('presences.class', { defaultValue: 'Classe' })}</th>
                <th>{t('presences.subject', { defaultValue: 'Matière' })}</th>
                <th>{t('presences.from', { defaultValue: 'Du' })}</th>
                <th>{t('presences.to', { defaultValue: 'Au' })}</th>
                <th className="text-center">{t('presences.exemption.attendance', { defaultValue: 'Présence obligatoire' })}</th>
                <th>{t('presences.comment', { defaultValue: 'Motif' })}</th>
              </tr>
            </thead>
            <tbody>
              {exemptions.map((x) => (
                <tr key={x.id}>
                  <td>{x.studentName}</td>
                  <td>{x.className || '—'}</td>
                  <td>{x.subjectName || '—'}</td>
                  <td>{dateFr(x.startDate)}</td>
                  <td>{dateFr(x.endDate)}</td>
                  <td className="text-center">{x.attendance ? t('presences.yes', { defaultValue: 'Oui' }) : t('presences.no', { defaultValue: 'Non' })}</td>
                  <td>{x.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Dispenses;
