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
  // Absences du jour (parité Angular : compteur « Nombre d'absents » en tête de tableau de bord).
  const todayEventsQuery = useQuery({ queryKey: ['pres', 'events-today', structureId, start], queryFn: () => api.getEvents(structureId, start, end), enabled: !!structureId });
  // Appels du jour (cours de la journée) + présences saisies du jour.
  const coursesQuery = useQuery({ queryKey: ['pres', 'courses-today', structureId, start], queryFn: () => api.getCourses(structureId, start), enabled: !!structureId });
  const presencesQuery = useQuery({ queryKey: ['pres', 'presences-today', structureId, start], queryFn: () => api.getPresences(structureId, start, end), enabled: !!structureId });

  const summary = summaryQuery.data ?? {};
  const forgotten = forgottenQuery.data ?? [];
  const statements = statementsQuery.data ?? [];
  const absentsToday = new Set((todayEventsQuery.data ?? []).map((e) => e.studentId)).size;
  const courses = coursesQuery.data ?? [];
  const presences = presencesQuery.data ?? [];

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
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-8 mb-16">
        <h1 className="m-0">{t('presences.dashboard.title', { defaultValue: 'Tableau de bord' })}</h1>
        {/* Parité Angular : date du jour + nombre d'absents du jour */}
        <div className="d-flex align-items-center gap-16">
          <strong style={{ textTransform: 'capitalize' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </strong>
          <span className="badge bg-secondary" style={{ fontSize: 13 }}>
            {t('presences.absents.today', { defaultValue: "Nombre d'absents :" })} {absentsToday}
          </span>
        </div>
      </div>

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

        {/* Appels du jour : cours de la journée avec l'état de l'appel (parité Angular) */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.today.calls', { defaultValue: 'Appels du jour' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({courses.length})</span>
          </h2>
          {coursesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!coursesQuery.isLoading && courses.length === 0 && (
            <p className="text-muted">{t('presences.today.calls.empty', { defaultValue: 'Aucun cours aujourd’hui.' })}</p>
          )}
          {courses.length > 0 && (
            <ul className="list-unstyled mb-0">
              {courses.map((c) => (
                <li key={c.id} className="d-flex justify-content-between align-items-center py-4 border-bottom gap-8">
                  <span>
                    <strong>{(c.classes ?? c.groups ?? []).join(', ')}</strong> — {c.subjectName ?? ''}
                    <span className="text-muted"> {heure(c.startDate)}</span>
                  </span>
                  {c.register_id
                    ? <span className="badge bg-success">{t('presences.call.done', { defaultValue: 'Appel fait' })}</span>
                    : <Link to="/registre" className="btn btn-sm btn-primary">{t('presences.do.call', { defaultValue: "Faire l'appel" })}</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Présences du jour : présences saisies (parité Angular) */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.today.presences', { defaultValue: 'Présences du jour' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({presences.length})</span>
          </h2>
          {presencesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!presencesQuery.isLoading && presences.length === 0 && (
            <p className="text-muted">{t('presences.today.presences.empty', { defaultValue: 'Aucune présence saisie ce jour.' })}</p>
          )}
          {presences.length > 0 && (
            <ul className="list-unstyled mb-0">
              {presences.map((p, i) => (
                <li key={p.id ?? i} className="py-4 border-bottom">
                  <strong>{(p.markers ?? []).map((m) => m.student?.displayName ?? '').filter(Boolean).join(', ') || '—'}</strong>
                  <span className="text-muted"> {heure(p.startDate)}</span>
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
