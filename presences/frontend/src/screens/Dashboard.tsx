import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { seuil, visibleByLabel } from '../utils';

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

  const list = (label: string, count: number, loading: boolean, items: Array<{ id: number; label: string }>, emptyKey: string, emptyDefault: string) => (
    <section className="card p-16 flex-grow-1" style={{ minWidth: 240 }}>
      <h2 style={{ fontSize: 18 }} className="mb-12">{label} <span className="text-muted" style={{ fontSize: 14 }}>({count})</span></h2>
      {loading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!loading && items.length === 0 && <p className="text-muted">{t(emptyKey, { defaultValue: emptyDefault })}</p>}
      {items.length > 0 && (
        <ul className="list-unstyled mb-0">
          {items.map((i) => <li key={i.id} className="py-4 border-bottom">{i.label}</li>)}
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

        {list(t('presences.actions', { defaultValue: 'Actions' }), actions.length, actionsQuery.isLoading, actions, 'presences.actions.empty', 'Aucune action.')}
        {list(t('presences.disciplines', { defaultValue: 'Dispositifs' }), disciplines.length, disciplinesQuery.isLoading, disciplines, 'presences.disciplines.empty', 'Aucun dispositif.')}
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
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
