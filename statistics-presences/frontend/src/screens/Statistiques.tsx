import { useHasWorkflow, useEdificeClient } from '@open-ent/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, GlobalResponse, MonthlyGraphResponse, MonthlyResponse, Person, WeeklyResponse } from '../api';
import { FilterPanel } from '../components/FilterPanel';
import { GlobalTable } from '../components/GlobalTable';
import { MonthlyChart } from '../components/MonthlyChart';
import { MonthlyTable } from '../components/MonthlyTable';
import { PersonSearch } from '../components/PersonSearch';
import { WeeklyGrid } from '../components/WeeklyGrid';
import {
  absenceSelected, addAudiences, audienceSelection, exportUrl, Filters, graphSeries, indicatorBody, INDICATOR_LABEL, indicatorTypes, IndicatorName, INDICATORS, initialFilters,
  monthLabels, monthlyTableTypes, NO_LATENESS_REASON, weeklyGrid,
} from '../indicators';
import { useStructure } from '../structure';
import { schoolYear, statLabel, todayIso } from '../utils';

type Display = 'TABLE' | 'GRAPH';
const ONE_D = 'fr.openent.statistics_presences.controller.FakeRight|statisticsPresences1d';

/**
 * Statistiques de présences — parité IHM AngularJS (CCTP 51C) : trois indicateurs (Global, Mensuel, Hebdomadaire),
 * recherche par élève ou par classe, période, paramètres (types, motifs, punitions, seuils, détail par créneau),
 * affichage en tableau ou en graphique (mensuel), taux d'absentéisme (global) et export CSV.
 */
export function Statistiques() {
  const { t } = useTranslation(['statistics-presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const oneD = useHasWorkflow(ONE_D) as boolean | undefined;

  const [name, setName] = useState<IndicatorName>('Global');
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [filters, setFilters] = useState<Filters | null>(null);
  const [draft, setDraft] = useState<Filters | null>(null);
  const [students, setStudents] = useState<Person[]>([]);
  const [audiences, setAudiences] = useState<Person[]>([]);
  const [display, setDisplay] = useState<Display>('TABLE');
  const [rateMode, setRateMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');

  const reasonsQuery = useQuery({ queryKey: ['stats', 'reasons', structureId], queryFn: () => api.getAllReasons(structureId), enabled: !!structureId });
  const punishmentQuery = useQuery({ queryKey: ['stats', 'punishment-types', structureId], queryFn: () => api.getPunishmentTypes(structureId), enabled: !!structureId });
  const settingsQuery = useQuery({ queryKey: ['stats', 'settings', structureId], queryFn: () => api.getSettings(structureId), enabled: !!structureId });
  const yearQuery = useQuery({ queryKey: ['stats', 'schoolyear', structureId], queryFn: () => api.getSchoolYear(structureId), enabled: !!structureId });

  // « Sans motif de retard » est un motif fictif d'identifiant 0.
  const reasons = useMemo(() => [NO_LATENESS_REASON, ...(reasonsQuery.data ?? [])], [reasonsQuery.data]);
  const punishmentTypes = useMemo(() => punishmentQuery.data ?? [], [punishmentQuery.data]);
  // Un compte réservé aux statistiques n'a pas toujours le droit de lire les motifs ni les types de punition : les
  // indicateurs restent consultables sans eux (aucun filtre par motif), avec un avertissement.
  const settled = (q: { isSuccess: boolean; isError: boolean }) => q.isSuccess || q.isError;
  const ready = !!structureId && oneD !== undefined && settled(reasonsQuery) && settled(punishmentQuery);
  const referenceMissing = reasonsQuery.isError || punishmentQuery.isError;

  // Premiers filtres : tous les types de l'indicateur et tous les motifs cochés.
  useEffect(() => {
    if (ready && filters === null) setFilters(initialFilters(name, reasons, punishmentTypes, oneD === true));
  }, [ready, filters, name, reasons, punishmentTypes, oneD]);

  const monthlyStart = yearQuery.data?.start ?? schoolYear().start;
  const switchIndicator = (next: IndicatorName) => {
    setName(next);
    setDisplay('TABLE');
    setExporting(false);
    setDraft(null);
    setFilters(initialFilters(next, reasons, punishmentTypes, oneD === true));
    setStart(next === 'Monthly' ? monthlyStart : todayIso());
    setEnd(todayIso());
    // La vue hebdomadaire ne porte que sur une classe ou un élève.
    if (next === 'Weekly') { setStudents(students.slice(0, 1)); setAudiences(students.length > 0 ? [] : audiences.slice(0, 1)); }
  };

  const weekly = name === 'Weekly';
  const addStudent = (p: Person) => { setAudiences([]); setStudents(weekly ? [p] : [...students, p]); };
  const addAudience = (p: Person) => { setStudents([]); const added = audienceSelection(p); setAudiences(weekly ? added.slice(0, 1) : addAudiences(audiences, added)); };

  // Types réellement demandés : en tableau mensuel, une seule famille d'événements.
  const types = !filters ? [] : name === 'Monthly' && display === 'TABLE' ? monthlyTableTypes(filters.types) : filters.types;
  const users = students.map((s) => s.id);
  const audienceIds = audiences.map((a) => a.id);
  const body = useMemo(
    () => (filters ? indicatorBody(filters, start, end, users, audienceIds, punishmentTypes, types) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, start, end, users.join(','), audienceIds.join(','), punishmentTypes, types.join(',')],
  );
  const canQuery = ready && !!body && types.length > 0 && (!weekly || students.length + audiences.length > 0);
  const key = JSON.stringify(body);

  const nextPage = (last: { data: unknown[] }, all: unknown[]) => (last.data.length > 0 ? all.length : undefined);
  const globalQuery = useInfiniteQuery({
    queryKey: ['stats', 'Global', structureId, key],
    queryFn: ({ pageParam }) => api.getIndicator<GlobalResponse>(structureId, 'Global', body!, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled: canQuery && name === 'Global',
  });
  const monthlyQuery = useInfiniteQuery({
    queryKey: ['stats', 'Monthly', structureId, key],
    queryFn: ({ pageParam }) => api.getIndicator<MonthlyResponse>(structureId, 'Monthly', body!, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled: canQuery && name === 'Monthly' && display === 'TABLE',
  });
  const graphQuery = useQuery({
    queryKey: ['stats', 'Monthly', 'graph', structureId, key],
    queryFn: () => api.getMonthlyGraph(structureId, body!),
    enabled: canQuery && name === 'Monthly' && display === 'GRAPH',
  });
  // Créneaux : ceux de la classe choisie (ou de la classe de l'élève), sinon ceux de l'établissement.
  const slotsQuery = useQuery({
    queryKey: ['stats', 'slots', structureId, users.join(','), audienceIds.join(',')],
    queryFn: async () => {
      let audience = audienceIds[0];
      if (!audience && users[0]) audience = (await api.getStudentAudience(structureId, users[0])) ?? '';
      return api.getSlots(structureId, audience || undefined);
    },
    enabled: ready && weekly,
  });
  const weeklyQuery = useQuery({
    queryKey: ['stats', 'Weekly', structureId, key],
    queryFn: () => api.getIndicator<WeeklyResponse>(structureId, 'Weekly', body!),
    enabled: canQuery && weekly,
  });

  const refreshMut = useMutation({
    mutationFn: (id: string) => api.refreshStudents(structureId, [id]),
    onSuccess: () => { setNotice('Statistiques recalculées.'); qc.invalidateQueries({ queryKey: ['stats', 'Global'] }); },
    onError: () => setNotice('Le recalcul a échoué.'),
  });

  const active = name === 'Global' ? globalQuery : name === 'Monthly' ? (display === 'TABLE' ? monthlyQuery : graphQuery) : weeklyQuery;
  const globalPages = globalQuery.data?.pages ?? [];
  const globalRows = globalPages.flatMap((p) => p.data);
  const lastGlobal = globalPages[globalPages.length - 1];
  const monthlyPages = monthlyQuery.data?.pages ?? [];
  const monthlyData = monthlyPages.flatMap((p) => p.data);
  const months = monthLabels(monthlyData);
  const graph: MonthlyGraphResponse | undefined = graphQuery.data;
  const grid = weekly && weeklyQuery.data && slotsQuery.data ? weeklyGrid(weeklyQuery.data.data, slotsQuery.data) : null;
  const hasMore = name === 'Global' ? globalQuery.hasNextPage : name === 'Monthly' && display === 'TABLE' ? monthlyQuery.hasNextPage : false;
  const loadMore = () => (name === 'Global' ? globalQuery.fetchNextPage() : monthlyQuery.fetchNextPage());
  const loading = canQuery && (name === 'Weekly' ? weeklyQuery.isLoading || slotsQuery.isLoading : active.isLoading);
  const failed = [active, ...(weekly ? [slotsQuery] : [])].some((q) => q.isError);

  const empty =
    canQuery && !loading && !failed &&
    (name === 'Global' ? globalRows.length === 0 : name === 'Monthly' ? (display === 'TABLE' ? monthlyData.every((a) => a.students.length === 0) : !graph || !graph.data) : !grid || grid.slots.length === 0);

  const rateAvailable = name === 'Global' && settingsQuery.data?.event_recovery_method !== 'HOUR';
  const openPanel = () => { setDraft(filters); };
  const applyPanel = () => { if (draft) setFilters(draft); setDraft(null); };
  const exportDisabled = !body || weekly;

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('statistics.title', { defaultValue: 'Statistiques' })}</h1>
        <div className="alert alert-info" role="alert">{t('statistics.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('statistics.title', { defaultValue: 'Statistiques de présences' })}</h1>

      <div className="d-flex gap-24 flex-wrap mb-12">
        <div style={{ minWidth: 260 }}>
          <PersonSearch
            id="sp-student" kind="students" label={t('statistics.search.student', { defaultValue: 'Rechercher un élève' })}
            search={(q) => api.searchStudents(structureId, q)} selected={students} onAdd={addStudent}
            onRemove={(p) => setStudents(students.filter((s) => s.id !== p.id))}
          />
        </div>
        <div style={{ minWidth: 260 }}>
          <PersonSearch
            id="sp-audience" kind="audiences" label={t('statistics.search.audience', { defaultValue: 'Rechercher une classe ou un groupe' })}
            search={(q) => api.searchAudiences(structureId, q, !weekly)} selected={audiences} onAdd={addAudience}
            onRemove={(p) => setAudiences(audiences.filter((a) => a.id !== p.id))}
          />
        </div>
      </div>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-12">
        <div>
          <label htmlFor="sp-indicator" className="form-label">{t('statistics.indicator', { defaultValue: 'Indicateur' })}</label>
          <select id="sp-indicator" className="form-control" value={name} onChange={(e) => switchIndicator(e.target.value as IndicatorName)}>
            {INDICATORS.map((i) => <option key={i} value={i}>{INDICATOR_LABEL[i]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sp-start" className="form-label">{t('statistics.from', { defaultValue: 'Du' })}</label>
          <input id="sp-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sp-end" className="form-label">{t('statistics.to', { defaultValue: 'Au' })}</label>
          <input id="sp-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {display === 'TABLE' && (
          <button type="button" className="btn btn-outline-primary" data-open-filters disabled={!filters} onClick={openPanel}>
            {t('statistics.parameters', { defaultValue: 'Paramètres' })}
          </button>
        )}
        {rateAvailable && (
          <label className="mb-8">
            <input type="checkbox" data-rate checked={rateMode} onChange={(e) => setRateMode(e.target.checked)} /> {t('statistics.display.rate', { defaultValue: "Afficher le taux d'absentéisme" })}
          </label>
        )}
        {name === 'Monthly' && (
          <div className="btn-group" role="group" aria-label="Mode d'affichage">
            <button type="button" data-display="TABLE" className={`btn btn-${display === 'TABLE' ? 'primary' : 'outline-primary'}`} aria-pressed={display === 'TABLE'}
              onClick={() => { setDisplay('TABLE'); if (filters) setFilters({ ...filters, types: monthlyTableTypes(filters.types) }); }}>
              {t('statistics.display.table', { defaultValue: 'Tableau' })}
            </button>
            <button type="button" data-display="GRAPH" className={`btn btn-${display === 'GRAPH' ? 'primary' : 'outline-primary'}`} aria-pressed={display === 'GRAPH'} onClick={() => { setDisplay('GRAPH'); setDraft(null); }}>
              {t('statistics.display.graph', { defaultValue: 'Graphique' })}
            </button>
          </div>
        )}
        <span className="ms-auto">
          {name === 'Monthly' ? (
            <button type="button" className="btn btn-outline-primary" data-export-open disabled={exportDisabled} onClick={() => setExporting(!exporting)}>
              {t('statistics.export.csv', { defaultValue: 'Exporter (CSV)' })}
            </button>
          ) : (
            <a className={`btn btn-outline-primary${exportDisabled ? ' disabled' : ''}`} data-export="CSV" aria-disabled={exportDisabled} href={exportDisabled || !body ? undefined : exportUrl(structureId, name, body)}>
              {t('statistics.export.csv', { defaultValue: 'Exporter (CSV)' })}
            </a>
          )}
        </span>
      </div>

      {exporting && body && (
        <div className="border rounded p-12 mb-12" data-export-choice>
          <p className="mb-8">{t('statistics.export.choice', { defaultValue: "Contenu de l'export" })}</p>
          <a className="btn btn-primary me-8" data-export="ALL" href={exportUrl(structureId, 'Monthly', body, 'ALL')} onClick={() => setExporting(false)}>
            {t('statistics.export.all', { defaultValue: 'Classes et élèves' })}
          </a>
          <a className="btn btn-outline-primary" data-export="AUDIENCES" href={exportUrl(structureId, 'Monthly', body, 'AUDIENCES')} onClick={() => setExporting(false)}>
            {t('statistics.export.audiences', { defaultValue: 'Classes seulement' })}
          </a>
        </div>
      )}

      {draft && (
        <FilterPanel
          filters={draft} onChange={setDraft} allowedTypes={indicatorTypes(name, oneD === true)} reasons={reasons} punishmentTypes={punishmentTypes}
          showThresholds={name !== 'Weekly'} showHourDetail={name !== 'Weekly'} onApply={applyPanel} onCancel={() => setDraft(null)}
        />
      )}

      {ready && referenceMissing && (
        <div className="alert alert-warning" role="alert" data-reference-missing>
          {t('statistics.reference.missing', { defaultValue: "Les motifs ou les types de punition ne sont pas accessibles avec ce compte : le filtre par motif n'est pas proposé." })}
        </div>
      )}
      {notice && <div className="alert alert-info" role="status" data-notice>{notice}</div>}
      {filters && display === 'TABLE' && !draft && (
        <p className="text-muted" data-active-types>{filters.types.map((x) => statLabel(x)).join(', ')}</p>
      )}
      {weekly && students.length + audiences.length === 0 && (
        <p className="text-muted" data-weekly-hint>{t('statistics.indicator.empty.filter', { defaultValue: 'Choisissez un élève ou une classe pour afficher la vue hebdomadaire.' })}</p>
      )}
      {filters && types.length === 0 && <p className="text-muted">{t('statistics.no.type', { defaultValue: "Sélectionnez au moins un type d'événement." })}</p>}
      {loading && <p>{t('statistics.loading', { defaultValue: 'Chargement…' })}</p>}
      {failed && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center" role="alert" data-load-error>
          <span>{t('statistics.error', { defaultValue: 'Une erreur est survenue.' })}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { active.refetch(); if (weekly) slotsQuery.refetch(); }}>{t('statistics.retry', { defaultValue: 'Réessayer' })}</button>
        </div>
      )}
      {empty && <p className="text-muted" data-empty>{t('statistics.indicator.empty.state', { defaultValue: 'Aucune donnée pour ces critères.' })}</p>}

      {name === 'Global' && globalRows.length > 0 && lastGlobal && filters && (
        <GlobalTable
          rows={globalRows} totals={{ count: lastGlobal.count ?? {}, rate: lastGlobal.rate ?? {}, slots: lastGlobal.slots ?? {} }}
          types={types} rateMode={rateMode} hourDetail={filters.hourDetail} busy={refreshMut.isPending} onRefresh={(id) => refreshMut.mutate(id)}
        />
      )}
      {name === 'Monthly' && display === 'TABLE' && monthlyData.some((a) => a.students.length > 0) && filters && (
        <MonthlyTable data={monthlyData} months={months} hourDetail={filters.hourDetail} showSlots={absenceSelected(types)} startOpen={students.length > 0} />
      )}
      {name === 'Monthly' && display === 'GRAPH' && graph?.data && <MonthlyChart series={graphSeries(graph.data, graph.months ?? [])} months={graph.months ?? []} />}
      {weekly && grid && grid.slots.length > 0 && <WeeklyGrid grid={grid} />}

      {hasMore && (
        <div className="text-center my-12">
          <button type="button" className="btn btn-outline-primary" data-more disabled={globalQuery.isFetchingNextPage || monthlyQuery.isFetchingNextPage} onClick={loadMore}>
            {t('statistics.more', { defaultValue: 'Afficher la suite' })}
          </button>
        </div>
      )}
    </div>
  );
}

export default Statistiques;
