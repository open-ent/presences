import { useEdificeClient } from '@open-ent/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { AlertType, ALERT_TYPES_LIST, addAudiences, audienceSelection, alertKey, alertParams, mergeAlerts, punishLink, resetBody, selectedStudents, typesFromParam } from '../alerts';
import { api } from '../api';
import { QueryErrors } from '../components/QueryErrors';
import { useStructure } from '../structure';
import { alerteLabel, jour, schoolYear } from '../utils';

type Person = { id: string; name: string };

/**
 * Alertes (parité IHM AngularJS) : élèves qui franchissent un seuil (absences, retards, incidents, oublis de carnet),
 * filtrés par type, période, élève et classe ; sélection pour remise à zéro ou punition ; export CSV.
 */
export function Alertes() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const [params] = useSearchParams();

  const [types, setTypes] = useState<AlertType[]>(() => typesFromParam(params.get('type')));
  const [start, setStart] = useState(schoolYear().start);
  const [end, setEnd] = useState(jour(new Date()));
  const [students, setStudents] = useState<Person[]>([]);
  const [classes, setClasses] = useState<Person[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  const filters = { structureId, types, studentIds: students.map((s) => s.id), classIds: classes.map((c) => c.id), start, end };
  const key = alertParams(filters);
  const listQuery = useInfiniteQuery({
    queryKey: ['pres', 'alerts', structureId, key],
    queryFn: ({ pageParam }) => api.getAlerts(structureId, alertParams(filters, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.all.length >= 20 ? all.length : undefined),
    enabled: !!structureId && types.length > 0,
  });
  const studentsQuery = useQuery({ queryKey: ['pres', 'students', structureId], queryFn: () => api.getStudents(structureId), enabled: !!structureId });
  const audienceTerm = classSearch.trim();
  const classesQuery = useQuery({ queryKey: ['pres', 'audiences', structureId, audienceTerm], queryFn: () => api.searchAudiences(structureId, audienceTerm), enabled: !!structureId && audienceTerm.length >= 1 });

  const alerts = (listQuery.data?.pages ?? []).reduce<ReturnType<typeof mergeAlerts>>((acc, p) => mergeAlerts(acc, p.all), []).filter((a) => a.name);
  const chosen = alerts.filter((a) => selected.has(alertKey(a)));
  const allChecked = alerts.length > 0 && chosen.length === alerts.length;

  const results = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return (studentsQuery.data ?? []).filter((s) => s.displayName.toLowerCase().includes(q) && !students.some((x) => x.id === s.id)).slice(0, 10);
  }, [studentsQuery.data, studentSearch, students]);
  const classResults = (classesQuery.data ?? []).filter((c) => !!c.members || !classes.some((x) => x.id === c.id)).slice(0, 10);

  const resetMut = useMutation({
    mutationFn: () => api.resetAlerts(structureId, resetBody(chosen, start, end)),
    onSuccess: () => { setSelected(new Set()); setNotice(t('presences.alert.reset.success', { defaultValue: 'Alertes remises à zéro.' })); qc.invalidateQueries({ queryKey: ['pres', 'alerts'] }); qc.invalidateQueries({ queryKey: ['pres', 'alert-summary'] }); },
  });

  const toggleType = (type: AlertType) => { setTypes(types.includes(type) ? types.filter((x) => x !== type) : [...types, type]); setSelected(new Set()); };
  const changed = () => setSelected(new Set());
  const toggleOne = (a: (typeof alerts)[number]) => { const n = new Set(selected); if (n.has(alertKey(a))) n.delete(alertKey(a)); else n.add(alertKey(a)); setSelected(n); };

  if (init && !structureId) {
    return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;
  }

  return (
    <div>
      <h1 className="mb-16">{t('presences.alerts.title', { defaultValue: 'Alertes' })}</h1>
      <QueryErrors queries={[listQuery]} />

      <div className="d-flex gap-24 flex-wrap mb-12">
        <div style={{ minWidth: 260 }}>
          <label htmlFor="al-student" className="form-label">{t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })}</label>
          <input id="al-student" className="form-control" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} autoComplete="off" />
          {results.length > 0 && (
            <ul className="list-unstyled border mb-0" data-student-results>
              {results.map((s) => <li key={s.id}><button type="button" className="btn btn-link" data-pick-student={s.id} onClick={() => { setStudents([...students, { id: s.id, name: s.displayName }]); setStudentSearch(''); changed(); }}>{s.displayName}</button></li>)}
            </ul>
          )}
          <div className="d-flex gap-8 flex-wrap mt-8" data-chosen-students>
            {students.map((s) => <span key={s.id} className="badge bg-secondary">{s.name} <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${s.name}`} onClick={() => { setStudents(students.filter((x) => x.id !== s.id)); changed(); }}>×</button></span>)}
          </div>
        </div>
        <div style={{ minWidth: 260 }}>
          <label htmlFor="al-class" className="form-label">{t('presences.exemptions.search.audience', { defaultValue: 'Rechercher une classe, un groupe ou un regroupement' })}</label>
          <input id="al-class" className="form-control" value={classSearch} onChange={(e) => setClassSearch(e.target.value)} autoComplete="off" />
          {classResults.length > 0 && (
            <ul className="list-unstyled border mb-0" data-class-results>
              {classResults.map((c) => <li key={c.id}><button type="button" className="btn btn-link" data-pick-class={c.id} onClick={() => { setClasses(addAudiences(classes, audienceSelection(c))); setClassSearch(''); changed(); }}>{c.name}{c.members ? ' (regroupement)' : ''}</button></li>)}
            </ul>
          )}
          <div className="d-flex gap-8 flex-wrap mt-8" data-chosen-classes>
            {classes.map((c) => <span key={c.id} className="badge bg-secondary">{c.name} <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${c.name}`} onClick={() => { setClasses(classes.filter((x) => x.id !== c.id)); changed(); }}>×</button></span>)}
          </div>
        </div>
      </div>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-12">
        <div>
          <label htmlFor="al-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="al-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); changed(); }} />
        </div>
        <div>
          <label htmlFor="al-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="al-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); changed(); }} />
        </div>
        <div className="d-flex gap-8 flex-wrap" role="group" aria-label={t('presences.alerts.types', { defaultValue: "Types d'alerte" })} data-types>
          {ALERT_TYPES_LIST.map((type) => (
            <button key={type} type="button" data-type={type} aria-pressed={types.includes(type)} className={`btn btn-sm ${types.includes(type) ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => toggleType(type)}>
              {t(`presences.alerts.filter.${type}`, { defaultValue: alerteLabel(type) })}
            </button>
          ))}
        </div>
        <span className="ms-auto d-flex gap-8">
          <a className="btn btn-outline-primary" data-export href={`/presences/structures/${structureId}/alerts/export${alertParams({ ...filters, start: undefined, end: undefined })}`} aria-disabled={types.length === 0}>
            {t('presences.export.tocsv', { defaultValue: 'Exporter (CSV)' })}
          </a>
          <a className={`btn btn-outline-primary${chosen.length === 0 ? ' disabled' : ''}`} data-punish aria-disabled={chosen.length === 0} href={chosen.length === 0 ? undefined : punishLink(selectedStudents(alerts, selected))}>
            {t('presences.alerts.punish', { defaultValue: 'Punition / sanction' })}
          </a>
          <button type="button" className="btn btn-primary" data-reset disabled={chosen.length === 0 || resetMut.isPending} onClick={() => resetMut.mutate()}>
            {t('presences.reset', { defaultValue: 'Remettre à zéro' })}
          </button>
        </span>
      </div>

      {notice && <div className="alert alert-success" role="status" data-notice>{notice}</div>}
      {resetMut.isError && <div className="alert alert-warning" role="alert" data-reset-error>{t('presences.error.reset.alert', { defaultValue: 'La remise à zéro a échoué.' })}</div>}
      {types.length === 0 && <p className="text-muted">{t('presences.alerts.no.type', { defaultValue: "Choisissez au moins un type d'alerte." })}</p>}
      {listQuery.isLoading && <p>{t('presences.alerts.loading', { defaultValue: 'Chargement des alertes…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && types.length > 0 && alerts.length === 0 && (
        <p className="text-muted" data-empty>{t('presences.alert.empty', { defaultValue: 'Aucune alerte sur la période.' })}</p>
      )}

      {alerts.length > 0 && (
        <>
          <label className="d-block mb-12">
            <input type="checkbox" data-select-all checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(alerts.map(alertKey)))} /> {t('presences.select.all', { defaultValue: 'Tout sélectionner' })}
          </label>
          <div className="d-flex gap-12 flex-wrap" data-alerts>
            {alerts.map((a) => (
              <button
                key={alertKey(a)}
                type="button"
                data-alert={alertKey(a)}
                aria-pressed={selected.has(alertKey(a))}
                className={`card p-12 text-start ${selected.has(alertKey(a)) ? 'border-primary' : ''}`}
                style={{ minWidth: 240, borderWidth: selected.has(alertKey(a)) ? 2 : 1 }}
                onClick={() => toggleOne(a)}
              >
                <div className="d-flex justify-content-between gap-12"><strong>{a.name}</strong><span>{a.audience}</span></div>
                <div className="text-muted"><span className="me-8">{a.count}</span>{t(`presences.alerts.type.${a.type}`, { defaultValue: alerteLabel(a.type) })}</div>
              </button>
            ))}
          </div>
          {listQuery.hasNextPage && (
            <div className="text-center my-12">
              <button type="button" className="btn btn-outline-primary" data-more disabled={listQuery.isFetchingNextPage} onClick={() => listQuery.fetchNextPage()}>
                {t('presences.more', { defaultValue: 'Afficher la suite' })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Alertes;
