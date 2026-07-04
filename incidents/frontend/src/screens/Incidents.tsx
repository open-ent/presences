import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { dateFr, heure, ouiNon } from '../utils';

/**
 * Incidents — parité IHM AngularJS (CCTP 51C) : liste des incidents de la structure sur une
 * période (GET /incidents/incidents), avec type / lieu / partenaire / gravité / protagonistes
 * résolus en clair, recherche élève/classe, bascule « traité », export CSV et saisie d'incident.
 */
export function Incidents() {
  const { t } = useTranslation(['incidents', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';
  const ownerId = (user as { userId?: string } | undefined)?.userId ?? '';

  const [start, setStart] = useState('2025-09-01');
  const [end, setEnd] = useState('2026-07-31');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'list', structureId, start, end],
    queryFn: () => api.getIncidents(structureId, start, end),
    enabled: !!structureId,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['incidents', 'list'] });

  // Recherche (parité Angular « Rechercher un élève / une classe ou un groupe ») :
  // filtre client sur protagonistes, type, lieu et description.
  const norm = (s: string) => s.toLocaleLowerCase('fr-FR');
  const incidents = (incidentsQuery.data ?? []).filter(
    (i) => !search.trim() || norm(`${i.protagonistes} ${i.typeLabel} ${i.placeLabel} ${i.description}`).includes(norm(search.trim())),
  );

  const processedMut = useMutation({
    mutationFn: ({ raw, processed }: { raw: (typeof incidents)[number]['raw']; processed: boolean }) =>
      api.setIncidentProcessed(raw, processed),
    onSuccess: invalidate,
  });

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('incidents.title', { defaultValue: 'Incidents' })}</h1>
        <div className="alert alert-info" role="alert">{t('incidents.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-16 flex-wrap gap-8">
        <h1 className="m-0">
          {t('incidents.title', { defaultValue: 'Incidents' })} <span className="text-muted" style={{ fontSize: 14 }}>({incidents.length})</span>
        </h1>
        <div className="d-flex gap-8">
          <a className="btn btn-secondary" href={api.incidentsExportUrl(structureId, start, end)}>
            {t('incidents.export.csv', { defaultValue: 'Exporter CSV' })}
          </a>
          {!creating && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              {t('incidents.new', { defaultValue: 'Saisir un incident' })}
            </button>
          )}
        </div>
      </div>

      {creating && (
        <IncidentForm
          structureId={structureId}
          ownerId={ownerId}
          onDone={() => {
            setCreating(false);
            invalidate();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="inc-start" className="form-label">{t('incidents.from', { defaultValue: 'Du' })}</label>
          <input id="inc-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="inc-end" className="form-label">{t('incidents.to', { defaultValue: 'Au' })}</label>
          <input id="inc-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div style={{ minWidth: 280 }}>
          <label htmlFor="inc-search" className="form-label">{t('incidents.search', { defaultValue: 'Rechercher un élève, une classe…' })}</label>
          <input
            id="inc-search"
            type="search"
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('incidents.search', { defaultValue: 'Rechercher un élève, une classe…' })}
          />
        </div>
      </div>

      {incidentsQuery.isLoading && <p>{t('incidents.loading', { defaultValue: 'Chargement…' })}</p>}
      {incidentsQuery.isError && <div className="alert alert-warning" role="alert">{t('incidents.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {!incidentsQuery.isLoading && incidents.length === 0 && (
        <p className="text-muted">{t('incidents.empty', { defaultValue: 'Aucun incident sur la période.' })}</p>
      )}
      {incidents.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('incidents.date', { defaultValue: 'Date' })}</th>
                <th>{t('incidents.type', { defaultValue: 'Type' })}</th>
                <th>{t('incidents.protagonists', { defaultValue: 'Protagonistes' })}</th>
                <th>{t('incidents.place', { defaultValue: 'Lieu' })}</th>
                <th>{t('incidents.seriousness', { defaultValue: 'Gravité' })}</th>
                <th>{t('incidents.partner', { defaultValue: 'Partenaire' })}</th>
                <th>{t('incidents.description', { defaultValue: 'Description' })}</th>
                <th className="text-center">{t('incidents.processed', { defaultValue: 'Traité' })}</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td>{dateFr(i.date)}{heure(i.date) ? ` ${heure(i.date)}` : ''}</td>
                  <td>{i.typeLabel || '—'}</td>
                  <td>{i.protagonistes || '—'}</td>
                  <td>{i.placeLabel || '—'}</td>
                  <td>{i.seriousnessLabel || '—'}</td>
                  <td>{i.partnerLabel || '—'}</td>
                  <td>{i.description || '—'}</td>
                  <td className="text-center">
                    {/* Bascule « traité » (parité Angular : toggle interactif) */}
                    <div className="form-check form-switch d-inline-block m-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        role="switch"
                        checked={i.processed}
                        disabled={processedMut.isPending}
                        aria-label={`${t('incidents.processed', { defaultValue: 'Traité' })} : ${ouiNon(i.processed)}`}
                        onChange={(e) => processedMut.mutate({ raw: i.raw, processed: e.target.checked })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {processedMut.isError && (
        <div className="alert alert-warning mt-8" role="alert">
          {t('incidents.processed.error', { defaultValue: 'La mise à jour du statut a échoué (droit requis).' })}
        </div>
      )}
    </div>
  );
}

/** Formulaire de saisie d'incident (parité Angular « Saisir un incident »). */
function IncidentForm({ structureId, ownerId, onDone, onCancel }: { structureId: string; ownerId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation(['incidents', 'common']);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('08:00');
  const [typeId, setTypeId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [seriousnessId, setSeriousnessId] = useState('');
  const [description, setDescription] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<Array<{ user_id: string; type_id: number; name: string }>>([]);
  const [protagonistTypeId, setProtagonistTypeId] = useState('');

  const typesQuery = useQuery({ queryKey: ['incidents', 'ref', 'types', structureId], queryFn: () => api.getIncidentTypes(structureId) });
  const placesQuery = useQuery({ queryKey: ['incidents', 'ref', 'places', structureId], queryFn: () => api.getPlaces(structureId) });
  const partnersQuery = useQuery({ queryKey: ['incidents', 'ref', 'partners', structureId], queryFn: () => api.getPartners(structureId) });
  const seriousnessQuery = useQuery({ queryKey: ['incidents', 'ref', 'seriousness', structureId], queryFn: () => api.getSeriousnesses(structureId) });
  const protaTypesQuery = useQuery({ queryKey: ['incidents', 'ref', 'prota-types', structureId], queryFn: () => api.getProtagonistTypes(structureId) });
  const studentsQuery = useQuery({ queryKey: ['incidents', 'students', structureId], queryFn: () => api.getStudents(structureId) });

  const protaTypes = protaTypesQuery.data ?? [];
  const norm = (s: string) => s.toLocaleLowerCase('fr-FR');
  const matches = useMemo(() => {
    const q = norm(studentSearch.trim());
    if (q.length < 2) return [];
    return (studentsQuery.data ?? []).filter((s) => norm(`${s.displayName} ${s.classe ?? ''}`).includes(q)).slice(0, 8);
  }, [studentSearch, studentsQuery.data]);

  const createMut = useMutation({
    mutationFn: () =>
      api.createIncident({
        ownerId,
        structureId,
        date: `${date}T${time}:00`,
        description: description.trim(),
        placeId: Number(placeId),
        partnerId: Number(partnerId),
        typeId: Number(typeId),
        seriousnessId: Number(seriousnessId),
        students: students.map((s) => ({ user_id: s.user_id, type_id: s.type_id })),
      }),
    onSuccess: onDone,
  });

  const valid = typeId && placeId && partnerId && seriousnessId && students.length > 0;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) createMut.mutate();
  };

  const addStudent = (s: { id: string; displayName: string; classe?: string }) => {
    const tId = Number(protagonistTypeId || protaTypes[0]?.id || 0);
    if (!tId || students.some((x) => x.user_id === s.id)) return;
    setStudents((prev) => [...prev, { user_id: s.id, type_id: tId, name: s.displayName }]);
    setStudentSearch('');
  };

  return (
    <form className="card p-16 mb-16" onSubmit={onSubmit}>
      <h2 style={{ fontSize: 18 }} className="mb-12">{t('incidents.new', { defaultValue: 'Saisir un incident' })}</h2>
      <div className="d-flex gap-12 flex-wrap mb-12">
        <div>
          <label htmlFor="new-inc-date" className="form-label">{t('incidents.date', { defaultValue: 'Date' })}</label>
          <input id="new-inc-date" type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="new-inc-time" className="form-label">{t('incidents.hour', { defaultValue: 'Heure' })}</label>
          <input id="new-inc-time" type="time" className="form-control" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="new-inc-type" className="form-label">{t('incidents.type', { defaultValue: 'Type' })}</label>
          <select id="new-inc-type" className="form-select" value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
            <option value="">—</option>
            {(typesQuery.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-inc-place" className="form-label">{t('incidents.place', { defaultValue: 'Lieu' })}</label>
          <select id="new-inc-place" className="form-select" value={placeId} onChange={(e) => setPlaceId(e.target.value)} required>
            <option value="">—</option>
            {(placesQuery.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-inc-serious" className="form-label">{t('incidents.seriousness', { defaultValue: 'Gravité' })}</label>
          <select id="new-inc-serious" className="form-select" value={seriousnessId} onChange={(e) => setSeriousnessId(e.target.value)} required>
            <option value="">—</option>
            {(seriousnessQuery.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-inc-partner" className="form-label">{t('incidents.partner', { defaultValue: 'Partenaire' })}</label>
          <select id="new-inc-partner" className="form-select" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
            <option value="">—</option>
            {(partnersQuery.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      </div>

      {/* Protagonistes : recherche annuaire + rôle */}
      <div className="d-flex gap-12 flex-wrap align-items-end mb-8">
        <div style={{ minWidth: 280, position: 'relative' }}>
          <label htmlFor="new-inc-student" className="form-label">{t('incidents.add.student', { defaultValue: 'Ajouter un élève' })}</label>
          <input
            id="new-inc-student"
            type="search"
            className="form-control"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder={t('incidents.search.student', { defaultValue: 'Nom de l’élève…' })}
            autoComplete="off"
          />
          {matches.length > 0 && (
            <ul className="list-group position-absolute w-100" style={{ zIndex: 10 }}>
              {matches.map((s) => (
                <li key={s.id} className="list-group-item p-0">
                  <button type="button" className="btn w-100 text-start" onClick={() => addStudent(s)}>
                    {s.displayName}{s.classe ? ` (${s.classe})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="new-inc-prota-type" className="form-label">{t('incidents.protagonist.type', { defaultValue: 'Rôle' })}</label>
          <select id="new-inc-prota-type" className="form-select" value={protagonistTypeId} onChange={(e) => setProtagonistTypeId(e.target.value)}>
            {protaTypes.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      </div>
      {students.length > 0 && (
        <div className="d-flex gap-8 flex-wrap mb-12">
          {students.map((s) => (
            <span key={s.user_id} className="badge bg-secondary">
              {s.name}{' '}
              <button
                type="button"
                className="btn btn-sm p-0 text-white"
                aria-label={`${t('incidents.remove', { defaultValue: 'Retirer' })} ${s.name}`}
                onClick={() => setStudents((prev) => prev.filter((x) => x.user_id !== s.user_id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mb-12">
        <label htmlFor="new-inc-desc" className="form-label">{t('incidents.description', { defaultValue: 'Description' })}</label>
        <textarea id="new-inc-desc" className="form-control" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {createMut.isError && (
        <div className="alert alert-warning" role="alert">{t('incidents.create.error', { defaultValue: 'La création a échoué (droit requis).' })}</div>
      )}
      <div className="d-flex gap-8">
        <button type="submit" className="btn btn-primary" disabled={!valid || createMut.isPending}>
          {t('incidents.create', { defaultValue: 'Créer l’incident' })}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{t('incidents.cancel', { defaultValue: 'Annuler' })}</button>
      </div>
    </form>
  );
}

export default Incidents;
