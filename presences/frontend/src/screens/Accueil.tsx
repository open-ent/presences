import { useEdificeClient } from '@open-ent/react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { api, ForgottenRegister, Statement } from '../api';
import { ALERT_TYPES, alerteLabel, classeLabel, dateFr, eleveNom, heure, jour } from '../utils';

/**
 * Tableau de bord d'accueil des présences (parité IHM AngularJS) :
 *  - synthèse des alertes (élèves franchissant les seuils, par type) ;
 *  - appels oubliés du jour (registres non faits) ;
 *  - déclarations d'absence des parents à traiter.
 * Vue par défaut du module.
 */
export function Accueil() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  // Plage du jour (les appels oubliés et déclarations récentes sont du jour courant).
  const { start, end } = useMemo(() => {
    const now = new Date();
    return { start: jour(now), end: jour(now) };
  }, []);

  const summaryQuery = useQuery({ queryKey: ['pres', 'alert-summary', structureId], queryFn: () => api.getAlertSummary(structureId), enabled: !!structureId });
  const forgottenQuery = useQuery({ queryKey: ['pres', 'forgotten', structureId, start], queryFn: () => api.getForgottenRegisters(structureId, start, end), enabled: !!structureId });
  const statementsQuery = useQuery({ queryKey: ['pres', 'statements', structureId, start], queryFn: () => api.getStatements(structureId, start, end, false), enabled: !!structureId });

  const summary = summaryQuery.data ?? {};
  const forgotten = forgottenQuery.data ?? [];
  const statements = statementsQuery.data ?? [];

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

  const subjectName = (r: ForgottenRegister) => r.subject_name || r.subject?.name || t('presences.course', { defaultValue: 'Cours' });
  const statementLabel = (s: Statement) => `${dateFr(s.start_at)}${s.end_at && dateFr(s.end_at) !== dateFr(s.start_at) ? ` → ${dateFr(s.end_at)}` : ''}`;

  return (
    <div>
      <h1 className="mb-16">{t('presences.dashboard.title', { defaultValue: 'Tableau de bord' })}</h1>

      {/* Synthèse des alertes : une carte KPI par type de seuil franchi */}
      <section className="mb-24">
        <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.alerts', { defaultValue: 'Alertes' })}</h2>
        {summaryQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
        <div className="d-flex gap-16 flex-wrap">
          {ALERT_TYPES.map((type) => {
            const count = summary[type] ?? 0;
            return (
              <div key={type} className="card p-16 text-center" style={{ minWidth: 160, flexGrow: 1 }} aria-label={alerteLabel(type)}>
                <div style={{ fontSize: 32, fontWeight: 700, color: count > 0 ? '#c0392b' : '#7f8c8d' }}>{count}</div>
                <div className="text-muted">{alerteLabel(type)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="d-flex gap-16 flex-wrap align-items-start">
        {/* Appels oubliés du jour */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.forgotten.registers', { defaultValue: 'Appels oubliés du jour' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({forgotten.length})</span>
          </h2>
          {forgottenQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!forgottenQuery.isLoading && forgotten.length === 0 && (
            <p className="text-muted">{t('presences.forgotten.empty', { defaultValue: 'Aucun appel oublié.' })}</p>
          )}
          {forgotten.length > 0 && (
            <ul className="list-unstyled mb-0">
              {forgotten.map((r, i) => (
                <li key={r.id ?? r.course_id ?? i} className="d-flex justify-content-between align-items-center py-4 border-bottom gap-8">
                  <span>
                    <strong>{classeLabel(r)}</strong> — {subjectName(r)}
                    <span className="text-muted"> {heure(r.start_date)}</span>
                  </span>
                  <Link to="/registre" className="btn btn-sm btn-primary">{t('presences.do.call', { defaultValue: "Faire l'appel" })}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Déclarations d'absence des parents à traiter */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.statements.title', { defaultValue: "Déclarations d'absence des parents" })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({statements.length})</span>
          </h2>
          {statementsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!statementsQuery.isLoading && statements.length === 0 && (
            <p className="text-muted">{t('presences.statements.empty', { defaultValue: 'Aucune déclaration à traiter.' })}</p>
          )}
          {statements.length > 0 && (
            <ul className="list-unstyled mb-0">
              {statements.map((s, i) => (
                <li key={s.id ?? i} className="d-flex justify-content-between align-items-center py-4 border-bottom gap-8">
                  <span>
                    <strong>{eleveNom(s)}</strong>
                    <span className="text-muted"> {statementLabel(s)}</span>
                  </span>
                  {s.is_treated || s.treated_at
                    ? <span className="badge bg-success">{t('presences.statement.treated', { defaultValue: 'Traitée' })}</span>
                    : <span className="badge bg-warning">{t('presences.statement.pending', { defaultValue: 'À traiter' })}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default Accueil;
