import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { ouiNon, seuil, visibleByLabel } from '../utils';

/** Paramétrage des présences : motifs d'absence (créer/supprimer), actions, dispositifs, réglages d'alerte. */
export function Dashboard() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';

  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const actionsQuery = useQuery({ queryKey: ['pres', 'actions', structureId], queryFn: () => api.getActions(structureId), enabled: !!structureId });
  const disciplinesQuery = useQuery({ queryKey: ['pres', 'disciplines', structureId], queryFn: () => api.getDisciplines(structureId), enabled: !!structureId });
  const settingsQuery = useQuery({ queryKey: ['pres', 'settings', structureId], queryFn: () => api.getSettings(structureId), enabled: !!structureId });

  const reasons = visibleByLabel(reasonsQuery.data ?? []);
  const actions = visibleByLabel(actionsQuery.data ?? []);
  const disciplines = visibleByLabel(disciplinesQuery.data ?? []);
  const settings = settingsQuery.data;

  // Création / suppression de motifs d'absence
  const [reasonLabel, setReasonLabel] = useState('');
  const [reasonProving, setReasonProving] = useState(true);
  const [reasonError, setReasonError] = useState('');
  const invalidateReasons = () => qc.invalidateQueries({ queryKey: ['pres', 'reasons', structureId] });
  const createReasonMut = useMutation({
    mutationFn: () =>
      api.createReason({
        structureId,
        label: reasonLabel.trim(),
        absenceCompliance: false,
        proving: reasonProving,
        excludeAlertRegularised: false,
        excludeAlertNoRegularised: false,
      }),
    onSuccess: () => { setReasonLabel(''); setReasonError(''); invalidateReasons(); },
    onError: () => setReasonError(t('presences.reason.error', { defaultValue: "La création du motif a échoué." })),
  });
  const deleteReasonMut = useMutation({ mutationFn: (id: number) => api.deleteReason(id), onSuccess: invalidateReasons });
  const onAddReason = (e: FormEvent) => {
    e.preventDefault();
    if (!reasonLabel.trim()) { setReasonError(t('presences.reason.label.required', { defaultValue: 'Le libellé est obligatoire.' })); return; }
    setReasonError('');
    createReasonMut.mutate();
  };

  // Création / suppression d'actions et de dispositifs (même pattern CRUD)
  const [actionLabel, setActionLabel] = useState('');
  const [disciplineLabel, setDisciplineLabel] = useState('');
  const invalidateActions = () => qc.invalidateQueries({ queryKey: ['pres', 'actions', structureId] });
  const invalidateDisciplines = () => qc.invalidateQueries({ queryKey: ['pres', 'disciplines', structureId] });
  const createActionMut = useMutation({ mutationFn: () => api.createAction(structureId, actionLabel.trim()), onSuccess: () => { setActionLabel(''); invalidateActions(); } });
  const deleteActionMut = useMutation({ mutationFn: (id: number) => api.deleteAction(id), onSuccess: invalidateActions });
  const createDisciplineMut = useMutation({ mutationFn: () => api.createDiscipline(structureId, disciplineLabel.trim()), onSuccess: () => { setDisciplineLabel(''); invalidateDisciplines(); } });
  const deleteDisciplineMut = useMutation({ mutationFn: (id: number) => api.deleteDiscipline(id), onSuccess: invalidateDisciplines });

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

  // Carte CRUD générique : liste + formulaire d'ajout (un libellé) + suppression par ligne.
  const crudCard = (opts: {
    title: string; items: Array<{ id: number; label: string }>; loading: boolean; emptyText: string;
    inputId: string; value: string; setValue: (v: string) => void; onAdd: () => void; adding: boolean; onDelete: (id: number) => void;
  }) => (
    <section className="card p-16 flex-grow-1" style={{ minWidth: 260 }}>
      <h2 style={{ fontSize: 18 }} className="mb-12">{opts.title} <span className="text-muted" style={{ fontSize: 14 }}>({opts.items.length})</span></h2>
      <form className="d-flex gap-8 align-items-end mb-8" onSubmit={(e) => { e.preventDefault(); if (opts.value.trim()) opts.onAdd(); }}>
        <div className="flex-grow-1">
          <label htmlFor={opts.inputId} className="form-label">{t('presences.new', { defaultValue: 'Nouveau libellé' })}</label>
          <input id={opts.inputId} className="form-control" value={opts.value} onChange={(e) => opts.setValue(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={opts.adding || !opts.value.trim()}>{t('presences.add', { defaultValue: 'Ajouter' })}</button>
      </form>
      {opts.loading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!opts.loading && opts.items.length === 0 && <p className="text-muted">{opts.emptyText}</p>}
      {opts.items.length > 0 && (
        <ul className="list-unstyled mb-0">
          {opts.items.map((i) => (
            <li key={i.id} className="d-flex justify-content-between align-items-center py-4 border-bottom">
              <span>{i.label}</span>
              <button type="button" className="btn btn-link p-0 text-danger" onClick={() => { if (window.confirm(t('presences.delete.confirm', { defaultValue: 'Supprimer cet élément ?' }))) opts.onDelete(i.id); }}>
                {t('presences.delete', { defaultValue: 'Supprimer' })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div>
      <h1 className="mb-16">{t('presences.title', { defaultValue: 'Présences' })}</h1>
      <p className="text-muted mb-16">
        {t('presences.dashboard.intro', { defaultValue: "Paramétrage de la présence pour l'établissement." })}
      </p>

      <div className="d-flex gap-16 flex-wrap align-items-start mb-16">
        {/* Motifs d'absence : liste + création + suppression */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 300 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.reasons', { defaultValue: "Motifs d'absence" })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({reasons.length})</span>
          </h2>
          <form className="d-flex gap-8 align-items-end flex-wrap mb-8" onSubmit={onAddReason}>
            <div className="flex-grow-1">
              <label htmlFor="reason-label" className="form-label">{t('presences.reason.label', { defaultValue: 'Nouveau motif' })}</label>
              <input id="reason-label" className="form-control" value={reasonLabel} onChange={(e) => setReasonLabel(e.target.value)} />
            </div>
            <div className="form-check d-flex align-items-center gap-4" style={{ paddingBottom: 8 }}>
              <input id="reason-proving" type="checkbox" className="form-check-input" checked={reasonProving} onChange={(e) => setReasonProving(e.target.checked)} />
              <label htmlFor="reason-proving" className="form-check-label">{t('presences.reason.proving', { defaultValue: 'Justificatif requis' })}</label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={createReasonMut.isPending}>{t('presences.reason.add', { defaultValue: 'Ajouter' })}</button>
          </form>
          {reasonError && <div className="alert alert-warning" role="alert">{reasonError}</div>}
          {reasonsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!reasonsQuery.isLoading && reasons.length === 0 && <p className="text-muted">{t('presences.reasons.empty', { defaultValue: 'Aucun motif.' })}</p>}
          {reasons.length > 0 && (
            <ul className="list-unstyled mb-0">
              {reasons.map((r) => (
                <li key={r.id} className="d-flex justify-content-between align-items-center py-4 border-bottom">
                  <span>{r.label}</span>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-danger"
                    onClick={() => { if (window.confirm(t('presences.reason.delete.confirm', { defaultValue: 'Supprimer ce motif ?' }))) deleteReasonMut.mutate(r.id); }}
                  >
                    {t('presences.delete', { defaultValue: 'Supprimer' })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {crudCard({
          title: t('presences.actions', { defaultValue: 'Actions' }), items: actions, loading: actionsQuery.isLoading,
          emptyText: t('presences.actions.empty', { defaultValue: 'Aucune action.' }),
          inputId: 'action-label', value: actionLabel, setValue: setActionLabel,
          onAdd: () => createActionMut.mutate(), adding: createActionMut.isPending, onDelete: (id) => deleteActionMut.mutate(id),
        })}
        {crudCard({
          title: t('presences.disciplines', { defaultValue: 'Dispositifs' }), items: disciplines, loading: disciplinesQuery.isLoading,
          emptyText: t('presences.disciplines.empty', { defaultValue: 'Aucun dispositif.' }),
          inputId: 'discipline-label', value: disciplineLabel, setValue: setDisciplineLabel,
          onAdd: () => createDisciplineMut.mutate(), adding: createDisciplineMut.isPending, onDelete: (id) => deleteDisciplineMut.mutate(id),
        })}
      </div>

      {/* Réglages d'alerte */}
      <section className="card p-16" style={{ maxWidth: 640 }}>
        <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.alerts', { defaultValue: "Seuils d'alerte" })}</h2>
        {settingsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
        {settings && (
          <table className="table mb-0">
            <tbody>
              <tr><td>{t('presences.alert.absence', { defaultValue: 'Absences' })}</td><td>{seuil(settings.alert_absence_threshold)}</td></tr>
              <tr><td>{t('presences.alert.lateness', { defaultValue: 'Retards' })}</td><td>{seuil(settings.alert_lateness_threshold)}</td></tr>
              <tr><td>{t('presences.alert.incident', { defaultValue: 'Incidents' })}</td><td>{seuil(settings.alert_incident_threshold)}</td></tr>
              <tr><td>{t('presences.alert.notebook', { defaultValue: 'Oublis de carnet' })}</td><td>{seuil(settings.alert_forgotten_notebook_threshold)}</td></tr>
              <tr><td>{t('presences.multipleSlots', { defaultValue: 'Appels multiples (cours > 1h)' })}</td><td>{ouiNon(settings.allow_multiple_slots)}</td></tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
