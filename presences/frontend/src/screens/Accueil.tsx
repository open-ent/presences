import { useEdificeClient } from '@open-ent/react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { api, ForgottenRegister, Statement } from '../api';
import { AbsencesWidget } from '../components/AbsencesWidget';
import { Tabs } from '../components/Tabs';
import { CurrentCourseWidget } from '../components/CurrentCourseWidget';
import { useMultipleSlot } from '../multipleSlot';
import { ALERT_TYPES, alerteLabel, classeLabel, dateFr, eleveNom, heure, jour } from '../utils';
import { QueryErrors } from '../components/QueryErrors';
import { useRights } from '../rights';
import { useStructure } from '../structure';

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
  const { structureId } = useStructure();
  const rights = useRights();

  // Plage du jour (les appels oubliés et déclarations récentes sont du jour courant).
  const { start, end } = useMemo(() => {
    const now = new Date();
    return { start: jour(now), end: jour(now) };
  }, []);

  const summaryQuery = useQuery({ queryKey: ['pres', 'alert-summary', structureId], queryFn: () => api.getAlertSummary(structureId), enabled: !!structureId && rights.widgetAlerts });
  const forgottenQuery = useQuery({ queryKey: ['pres', 'forgotten', structureId, start], queryFn: () => api.getForgottenRegisters(structureId, start, end), enabled: !!structureId && rights.widgetForgottenRegisters });
  const statementsQuery = useQuery({ queryKey: ['pres', 'statements', structureId, start], queryFn: () => api.getStatements(structureId, start, end, false), enabled: !!structureId && rights.widgetStatements });
  // Absences du jour (parité Angular : compteur « Nombre d'absents » en tête de tableau de bord).
  const todayEventsQuery = useQuery({ queryKey: ['pres', 'events-today', structureId, start], queryFn: () => api.getEvents(structureId, start, end), enabled: !!structureId && rights.readEvent });
  // Appels du jour (cours de la journée) + présences saisies du jour.
  const slots = useMultipleSlot(structureId);
  const coursesQuery = useQuery({ queryKey: ['pres', 'courses-today', structureId, start, slots.value], queryFn: () => api.getCourses(structureId, start, undefined, slots.value), enabled: !!structureId && rights.widgetDayCourses && slots.ready });
  const presencesQuery = useQuery({ queryKey: ['pres', 'presences-today', structureId, start], queryFn: () => api.getPresences(structureId, start, end), enabled: !!structureId && rights.widgetDayPresences });

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

  const blocks = {
    widgetAlerts: (
<section className="mb-24">
        <h2 style={{ fontSize: 18 }} className="mb-12">{t('presences.alerts', { defaultValue: 'Alertes' })}</h2>
        {summaryQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
        <div className="d-flex gap-16 flex-wrap">
          {ALERT_TYPES.map((type) => {
            const count = summary[type] ?? 0;
            return (
              <Link key={type} to={`/alertes?type=${type}`} className="card p-16 text-center text-decoration-none" style={{ minWidth: 160, flexGrow: 1 }} aria-label={alerteLabel(type)} data-alert-card={type}>
                <div style={{ fontSize: 32, fontWeight: 700, color: count > 0 ? '#c0392b' : '#7f8c8d' }}>{count}</div>
                <div className="text-muted">{alerteLabel(type)}</div>
              </Link>
            );
          })}
        </div>
      </section>
    ),
    widgetForgottenRegisters: (
<section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.forgotten.registers', { defaultValue: 'Appels oubliés du jour' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({forgotten.length})</span>
          </h2>
          {forgottenQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!forgottenQuery.isLoading && !forgottenQuery.isError && forgotten.length === 0 && (
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
    ),
    widgetStatements: (
<section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.statements.title', { defaultValue: "Déclarations d'absence des parents" })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({statements.length})</span>
          </h2>
          {statementsQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!statementsQuery.isLoading && !statementsQuery.isError && statements.length === 0 && (
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
    ),
    widgetDayCourses: (
<section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.today.calls', { defaultValue: 'Appels du jour' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({courses.length})</span>
          </h2>
          {slots.canChoose && (
            <div className="form-check form-switch mb-12" data-multiple-slot>
              <input id="multiple-slot" type="checkbox" role="switch" className="form-check-input" checked={slots.value} disabled={slots.saving} onChange={(e) => slots.setValue(e.target.checked)} />
              <label htmlFor="multiple-slot" className="form-check-label" title={slots.value
                ? t('presences.widgets.day.set.multiple.slot.toolip.disable', { defaultValue: "Désactivez cette option pour générer un appel unique pour les cours dépassant 1h. Valable à partir du prochain cours." })
                : t('presences.widgets.day.set.multiple.slot.toolip.activate', { defaultValue: "Activez cette option pour générer plusieurs appels pour les cours dépassant 1h. Valable à partir du prochain cours si l'appel n'a pas déjà été ouvert." })}>
                {t('presences.widgets.day.set.multiple.slot', { defaultValue: 'Appels multiples pour mes cours dépassant 1h' })}
              </label>
              {slots.error && <span className="text-danger ms-8" role="alert" data-multiple-slot-error>{t('presences.error', { defaultValue: "L'opération a échoué." })}</span>}
            </div>
          )}
          {coursesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!coursesQuery.isLoading && !coursesQuery.isError && courses.length === 0 && (
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
    ),
    widgetDayPresences: (
<section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('presences.today.presences', { defaultValue: 'Présences du jour' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({presences.length})</span>
          </h2>
          {presencesQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {!presencesQuery.isLoading && !presencesQuery.isError && presences.length === 0 && (
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
    ),
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-8 mb-16">
        <h1 className="m-0">{t('presences.dashboard.title', { defaultValue: 'Tableau de bord' })}</h1>
      <QueryErrors queries={[rights.widgetAlerts && summaryQuery, rights.widgetForgottenRegisters && forgottenQuery, rights.widgetStatements && statementsQuery, rights.readEvent && todayEventsQuery, rights.widgetDayCourses && coursesQuery, rights.widgetDayPresences && presencesQuery].filter((q): q is typeof summaryQuery => !!q)} />
        {/* Parité Angular : date du jour + nombre d'absents du jour */}
        <div className="d-flex align-items-center gap-16">
          <strong style={{ textTransform: 'capitalize' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </strong>
          {rights.readEvent && (
            <span className="badge" data-absents-today style={{ fontSize: 13, backgroundColor: '#495057', color: '#fff' }}>
              {t('presences.absents.today', { defaultValue: "Nombre d'absents :" })} {absentsToday}
            </span>
          )}
        </div>
      </div>

      {rights.ready && !rights.staff && (
        <div className="alert alert-info" role="status" data-no-rights>
          {t('presences.no.rights', { defaultValue: "Votre compte n'a accès à aucune fonction de ce module." })}
        </div>
      )}
      <Tabs label={t('presences.dashboard.tabs', { defaultValue: 'Blocs du tableau de bord' })} tabs={[
        { key: 'current-course', label: t('presences.widgets.current.course', { defaultValue: 'Cours en cours' }), visible: rights.widgetCurrentCourse, content: <CurrentCourseWidget structureId={structureId} /> },
        { key: 'absences', label: t('presences.widgets.absences', { defaultValue: 'Absences' }), visible: rights.widgetAbsences, content: <AbsencesWidget structureId={structureId} /> },
        { key: 'alerts', label: t('presences.alerts', { defaultValue: 'Alertes' }), visible: rights.widgetAlerts, content: blocks.widgetAlerts },
        { key: 'forgotten', label: t('presences.forgotten.registers', { defaultValue: 'Appels oubliés' }), visible: rights.widgetForgottenRegisters, content: blocks.widgetForgottenRegisters },
        { key: 'statements', label: t('presences.statements', { defaultValue: "Déclarations d'absence" }), visible: rights.widgetStatements, content: blocks.widgetStatements },
        { key: 'day-courses', label: t('presences.today.calls', { defaultValue: 'Appels du jour' }), visible: rights.widgetDayCourses, content: blocks.widgetDayCourses },
        { key: 'day-presences', label: t('presences.today.presences', { defaultValue: 'Présences du jour' }), visible: rights.widgetDayPresences, content: blocks.widgetDayPresences },
      ]} />
    </div>
  );
}

export default Accueil;
