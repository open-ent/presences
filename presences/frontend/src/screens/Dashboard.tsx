import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { seuil, visibleByLabel } from '../utils';

/** Paramétrage des présences : motifs d'absence, actions, dispositifs, réglages d'alerte. */
export function Dashboard() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const actionsQuery = useQuery({ queryKey: ['pres', 'actions', structureId], queryFn: () => api.getActions(structureId), enabled: !!structureId });
  const disciplinesQuery = useQuery({ queryKey: ['pres', 'disciplines', structureId], queryFn: () => api.getDisciplines(structureId), enabled: !!structureId });
  const settingsQuery = useQuery({ queryKey: ['pres', 'settings', structureId], queryFn: () => api.getSettings(structureId), enabled: !!structureId });

  const reasons = visibleByLabel(reasonsQuery.data ?? []);
  const actions = visibleByLabel(actionsQuery.data ?? []);
  const disciplines = visibleByLabel(disciplinesQuery.data ?? []);
  const settings = settingsQuery.data;

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
        {list(t('presences.reasons', { defaultValue: "Motifs d'absence" }), reasons.length, reasonsQuery.isLoading, reasons, 'presences.reasons.empty', 'Aucun motif.')}
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
