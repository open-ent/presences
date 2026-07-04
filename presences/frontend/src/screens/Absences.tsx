import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { visibleByLabel } from '../utils';

/** Saisie d'absences : recherche élève → création d'une absence + liste. Nécessite droit ADML/vie sco. */
export function Absences() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';

  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonId, setReasonId] = useState<number | ''>('');
  const [formError, setFormError] = useState('');

  const studentsQuery = useQuery({ queryKey: ['pres', 'students', structureId], queryFn: () => api.getStudents(structureId), enabled: !!structureId });
  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const reasons = visibleByLabel(reasonsQuery.data ?? []);

  const absKey = ['pres', 'absences', structureId, studentId];
  const absencesQuery = useQuery({
    queryKey: absKey,
    queryFn: () => api.getStudentAbsences(structureId, studentId, '2025-09-01', '2026-08-31'),
    enabled: !!structureId && !!studentId,
  });

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (studentsQuery.data ?? []).filter((s) => s.displayName.toLowerCase().includes(q)).slice(0, 20);
  }, [studentsQuery.data, search]);

  const toDatetime = (d: string, time: string) => (d ? `${d} ${time}` : '');
  const createMut = useMutation({
    mutationFn: () => api.createAbsence(structureId, studentId, toDatetime(startDate, '08:00:00'), toDatetime(endDate || startDate, '18:00:00'), reasonId === '' ? null : Number(reasonId)),
    onSuccess: () => { setStartDate(''); setEndDate(''); setReasonId(''); setFormError(''); qc.invalidateQueries({ queryKey: absKey }); },
    onError: () => setFormError(t('presences.absence.error', { defaultValue: "La saisie de l'absence a échoué." })),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!studentId || !startDate) { setFormError(t('presences.absence.incomplete', { defaultValue: "Sélectionnez un élève et une date de début." })); return; }
    setFormError('');
    createMut.mutate();
  };

  if (init && !structureId) return <div><h1>{t('presences.absences.title', { defaultValue: 'Absences' })}</h1></div>;

  return (
    <div>
      <h1 className="mb-16">{t('presences.absences.title', { defaultValue: 'Saisie des absences' })}</h1>

      {/* Recherche d'élève */}
      <div className="mb-16" style={{ maxWidth: 520, position: 'relative' }}>
        <label htmlFor="abs-search" className="form-label">{t('presences.absence.search', { defaultValue: 'Rechercher un élève' })}</label>
        <input id="abs-search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" placeholder={t('presences.absence.search.ph', { defaultValue: 'Nom de l’élève (min. 2 caractères)' })} />
        {results.length > 0 && (
          <ul className="list-unstyled border rounded bg-white" style={{ position: 'absolute', zIndex: 5, width: '100%', maxHeight: 260, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
            {results.map((s) => (
              <li key={s.id}>
                <button type="button" className="btn btn-link text-start w-100 px-12 py-4" onClick={() => { setStudentId(s.id); setStudentName(s.displayName); setSearch(s.displayName); }}>{s.displayName}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!studentId && <p className="text-muted">{t('presences.absence.select', { defaultValue: 'Sélectionnez un élève pour saisir une absence.' })}</p>}

      {studentId && (
        <div className="d-flex gap-16 flex-wrap align-items-start">
          {/* Formulaire de saisie */}
          <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
            <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.absence.new', { defaultValue: 'Nouvelle absence' })} — {studentName}</h2>
            <form onSubmit={onSubmit}>
              <div className="d-flex gap-8 flex-wrap mb-8">
                <div><label htmlFor="abs-start" className="form-label">{t('presences.absence.start', { defaultValue: 'Du' })}</label><input id="abs-start" type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div><label htmlFor="abs-end" className="form-label">{t('presences.absence.end', { defaultValue: 'Au' })}</label><input id="abs-end" type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                <div><label htmlFor="abs-reason" className="form-label">{t('presences.absence.reason', { defaultValue: 'Motif' })}</label>
                  <select id="abs-reason" className="form-select" value={reasonId} onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">{t('presences.absence.noreason', { defaultValue: 'Non renseigné' })}</option>
                    {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              {formError && <div className="alert alert-warning" role="alert">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{t('presences.absence.add', { defaultValue: 'Enregistrer l’absence' })}</button>
            </form>
          </section>

          {/* Liste des absences */}
          <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
            <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.absences.list', { defaultValue: 'Absences de l’élève' })}</h2>
            {absencesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
            {!absencesQuery.isLoading && (absencesQuery.data ?? []).length === 0 && <p className="text-muted mb-0">{t('presences.absences.empty', { defaultValue: 'Aucune absence enregistrée.' })}</p>}
            {(absencesQuery.data ?? []).length > 0 && (
              <ul className="list-unstyled mb-0">
                {(absencesQuery.data ?? []).map((a) => (
                  <li key={a.id} className="py-4 border-bottom">{(a.start_date ?? '').slice(0, 16)} → {(a.end_date ?? '').slice(0, 16)}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default Absences;
