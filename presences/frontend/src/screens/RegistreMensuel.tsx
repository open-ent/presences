import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { QueryErrors } from '../components/QueryErrors';
import {
  BAR_COLOR, BAR_LABEL, callRegisterExportUrl, currentMonth, dayBars, eventLine, eventListExportUrl, hasNothingToShow, monthDays, REGISTRY_TYPES, registryUrl,
  RegistryDay, RegistryFilters, RegistryType, schoolMonths,
} from '../registry';
import { useRights } from '../rights';
import { useStructure } from '../structure';
import { dateFr } from '../utils';

const TYPE_LABEL: Record<RegistryType, string> = { ABSENCE: 'Absences', LATENESS: 'Retards', INCIDENT: 'Incidents', DEPARTURE: 'Départs' };

/**
 * Registre mensuel (parité IHM AngularJS) : pour les classes choisies, un tableau élèves × jours du mois avec une barre
 * colorée par type d'événement ; fiche détaillée d'une journée ; export de la liste des événements et du registre d'appel.
 */
export function RegistreMensuel() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const { structureId } = useStructure();
  const rights = useRights();

  const [month, setMonth] = useState(currentMonth());
  const [groups, setGroups] = useState<PickedAudience[]>([]);
  const [chosen, setTypes] = useState<RegistryType[]>(REGISTRY_TYPES);
  // Les incidents n'existent pas dans un établissement du 1er degré : ils ne sont jamais demandés.
  const types = chosen.filter((x) => !(x === 'INCIDENT' && rights.oneD));
  const [forgotten, setForgotten] = useState(false);
  const [card, setCard] = useState<{ student: string; day: RegistryDay } | null>(null);

  const filters: RegistryFilters = { structureId, month, groupIds: groups.map((g) => g.id), types, forgottenNotebook: forgotten };
  const nothing = hasNothingToShow(filters);
  const query = useQuery({ queryKey: ['pres', 'registry', registryUrl(filters)], queryFn: () => api.getRegistry(registryUrl(filters)), enabled: !!structureId && !nothing });
  const students = nothing ? [] : (query.data ?? []);
  const days = monthDays(students);
  const available = REGISTRY_TYPES.filter((x) => !(x === 'INCIDENT' && rights.oneD));

  const toggle = (x: RegistryType) => { setTypes(types.includes(x) ? types.filter((y) => y !== x) : [...types, x]); setCard(null); };
  const emptyMessage = filters.groupIds.length === 0 && types.length === 0 && !forgotten
    ? t('presences.registry.empty.state.both', { defaultValue: "Choisissez une classe et au moins un type d'événement." })
    : filters.groupIds.length === 0
      ? t('presences.registry.empty.state', { defaultValue: 'Choisissez une ou plusieurs classes pour afficher le registre.' })
      : t('presences.registry.empty.state.filter', { defaultValue: "Choisissez au moins un type d'événement." });

  if (init && !structureId) {
    return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;
  }

  return (
    <div>
      <h1 className="mb-16">{t('presences.registry.title', { defaultValue: 'Registre mensuel' })}</h1>
      <QueryErrors queries={[query]} />

      <div className="d-flex gap-24 flex-wrap align-items-end mb-12">
        <div style={{ minWidth: 280 }}>
          <AudienceSearch id="rm-class" label={t('presences.dashboard.search.registry.placeholder', { defaultValue: 'Rechercher une classe' })} structureId={structureId} selected={groups} onChange={(next) => { setGroups(next); setCard(null); }} />
        </div>
        <div>
          <label htmlFor="rm-month" className="form-label">{t('presences.months', { defaultValue: 'Mois' })}</label>
          <select id="rm-month" className="form-control" value={month} onChange={(e) => { setMonth(e.target.value); setCard(null); }}>
            {schoolMonths().map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            {!schoolMonths().some((m) => m.value === month) && <option value={month}>{month}</option>}
          </select>
        </div>
        <span className="ms-auto d-flex gap-8">
          <a className={`btn btn-outline-primary${groups.length === 0 ? ' disabled' : ''}`} data-export="events" aria-disabled={groups.length === 0 || nothing} href={groups.length === 0 || nothing ? undefined : eventListExportUrl(filters)}>
            {t('presences.export.tocsv', { defaultValue: 'Exporter la liste (CSV)' })}
          </a>
          <a className={`btn btn-outline-primary${groups.length === 0 ? ' disabled' : ''}`} data-export="call-register" aria-disabled={groups.length === 0} href={groups.length === 0 ? undefined : callRegisterExportUrl(filters)}>
            {t('presences.export.new.csv', { defaultValue: "Exporter le registre d'appel (CSV)" })}
          </a>
        </span>
      </div>

      <div className="d-flex gap-8 flex-wrap mb-12" role="group" aria-label={t('presences.registry.types', { defaultValue: "Types d'événement" })} data-types>
        {available.map((x) => (
          <button key={x} type="button" data-type={x} aria-pressed={types.includes(x)} className={`btn btn-sm ${types.includes(x) ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => toggle(x)}>
            {t(`presences.register.event_type.${x.toLowerCase()}`, { defaultValue: TYPE_LABEL[x] })}
          </button>
        ))}
        {rights.forgottenNotebook && (
          <button type="button" data-type="FORGOTTEN_NOTEBOOK" aria-pressed={forgotten} className={`btn btn-sm ${forgotten ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setForgotten(!forgotten); setCard(null); }}>
            {t('presences.register.event_type.forgotten.notebook', { defaultValue: 'Carnets oubliés' })}
          </button>
        )}
      </div>

      <ul className="list-unstyled d-flex gap-16 flex-wrap mb-16" data-legend>
        {(Object.keys(BAR_COLOR) as Array<keyof typeof BAR_COLOR>)
          .filter((b) => !(b === 'incident' && rights.oneD) && !(b === 'forgotten-notebook' && !rights.forgottenNotebook))
          .map((b) => (
            <li key={b}><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: BAR_COLOR[b], marginRight: 6, verticalAlign: 'middle' }} />{BAR_LABEL[b]}</li>
          ))}
      </ul>

      {nothing && <p className="text-muted" data-empty-state>{emptyMessage}</p>}
      {query.isLoading && !nothing && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!nothing && !query.isLoading && !query.isError && students.length === 0 && <p className="text-muted" data-empty>{t('presences.registry.empty', { defaultValue: 'Aucun élève pour ces classes.' })}</p>}

      {card && (
        <aside className="border rounded p-12 mb-12" data-event-card role="dialog" aria-label={`${card.student} ${dateFr(card.day.date)}`}>
          <div className="d-flex justify-content-between"><strong>{card.student}</strong><button type="button" className="btn btn-link p-0" aria-label="Fermer" onClick={() => setCard(null)}>✕</button></div>
          <div className="text-muted mb-8">{dateFr(card.day.date)}</div>
          <ul className="list-unstyled mb-0">
            {card.day.forgottenNotebook && <li data-card-line="forgotten-notebook"><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: BAR_COLOR['forgotten-notebook'], marginRight: 6 }} />{BAR_LABEL['forgotten-notebook']}</li>}
            {[...card.day.events].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')).map((e, i) => {
              const l = eventLine(e);
              return (
                <li key={i} data-card-line={l.kind}>
                  <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: BAR_COLOR[l.kind], marginRight: 6 }} />
                  <strong>{l.title}</strong>{l.detail ? ` — ${l.detail}` : ''}
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      {students.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0" data-registry-table style={{ tableLayout: 'fixed', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 200 }}>{t('presences.register.legend.students', { defaultValue: 'Élèves' })}</th>
                {days.map((d) => <th key={d} className="text-center" style={{ padding: 2 }}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} data-student={s.id}>
                  <td className="text-nowrap">{s.displayName}{s.className ? <span className="text-muted"> {s.className}</span> : null}</td>
                  {s.days.map((day) => {
                    const bars = dayBars(day);
                    const clickable = day.events.length > 0 || day.forgottenNotebook;
                    return (
                      <td
                        key={day.date}
                        data-day={day.date}
                        data-bars={bars.join(' ')}
                        className={day.exclude ? 'table-secondary' : ''}
                        style={{ padding: 2, cursor: clickable ? 'pointer' : 'default', verticalAlign: 'top' }}
                        onClick={() => clickable && setCard({ student: s.displayName, day })}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 24 }}>
                          {bars.map((b) => <span key={b} title={BAR_LABEL[b]} style={{ display: 'block', height: Math.max(6, Math.floor(24 / bars.length)), background: BAR_COLOR[b], borderRadius: 2 }} />)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RegistreMensuel;
