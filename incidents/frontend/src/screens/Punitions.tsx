import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { QueryErrors } from '../components/QueryErrors';
import { Pager } from '../components/Pager';
import { CATEGORY_LABEL, CategoryId, PunishmentForm, ProcessFilter, emptyForm, emptySlot, formError, listParams } from '../punishments';
import { canCreateType, useRights } from '../rights';
import { useStructure } from '../structure';
import { dateFr, schoolYear } from '../utils';

const FORM_ERRORS: Record<string, string> = {
  type: 'Choisissez un type de punition ou de sanction.',
  students: 'Choisissez au moins un élève.',
  delay: 'Indiquez la date de remise.',
  slots: 'Renseignez la date et les horaires de chaque créneau.',
  'slot-order': "L'heure de fin doit suivre l'heure de début.",
  period: "Indiquez les dates de début et de fin de l'exclusion.",
  'period-order': 'La fin ne peut pas précéder le début.',
};

/**
 * Punitions / sanctions — parité IHM AngularJS (CCTP 51C) : liste filtrée (période, type, traitement), création
 * (travail supplémentaire, retenue, blâme, exclusion), marquage « traité », suppression, export.
 */
export function Punitions() {
  const { t } = useTranslation(['incidents', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const rights = useRights();

  const [start, setStart] = useState(schoolYear().start);
  const [end, setEnd] = useState(schoolYear().end);
  const [process, setProcess] = useState<ProcessFilter>('all');
  const [typeIds, setTypeIds] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PunishmentForm>(emptyForm(''));
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState(false);

  const params = listParams(structureId, start, end, process, typeIds);
  const punishmentsQuery = useQuery({ queryKey: ['incidents', 'punishments', params, page], queryFn: () => api.getPunishments(params, page), enabled: !!structureId });
  const typesQuery = useQuery({ queryKey: ['incidents', 'punishment-types', structureId], queryFn: () => api.getPunishmentTypes(structureId), enabled: !!structureId });
  const placesQuery = useQuery({ queryKey: ['incidents', 'places', structureId], queryFn: () => api.getPlaces(structureId), enabled: !!structureId && creating });
  const studentsQuery = useQuery({ queryKey: ['incidents', 'students', structureId], queryFn: () => api.getStudents(structureId), enabled: !!structureId && creating });

  const punishments = punishmentsQuery.data?.items ?? [];
  const allTypes = (typesQuery.data ?? []).filter((ty) => !ty.hidden);
  const creatable = allTypes.filter((ty) => canCreateType(rights, ty.type));
  const canManage = rights.createPunishment || rights.createSanction;
  const places = placesQuery.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['incidents', 'punishments'] });
  const processMut = useMutation({ mutationFn: (v: { p: (typeof punishments)[number]; value: boolean }) => api.setPunishmentProcessed(v.p.raw, v.value), onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: (p: (typeof punishments)[number]) => api.deletePunishment(p.raw), onSuccess: invalidate });
  const createMut = useMutation({
    mutationFn: () => api.createPunishment(form),
    onSuccess: () => { setCreating(false); setCreated(true); setSubmitted(false); setSearch(''); invalidate(); },
  });

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (studentsQuery.data ?? []).filter((s) => s.displayName.toLowerCase().includes(q) && !form.studentIds.includes(s.id)).slice(0, 10);
  }, [studentsQuery.data, search, form.studentIds]);
  const nameOf = (id: string) => studentsQuery.data?.find((s) => s.id === id)?.displayName ?? id;

  const err = formError(form);
  const set = (patch: Partial<PunishmentForm>) => setForm((f) => ({ ...f, ...patch }));
  const setSlot = (i: number, patch: Partial<PunishmentForm['slots'][number]>) => set({ slots: form.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const openForm = () => { setForm(emptyForm(structureId)); setSubmitted(false); setCreated(false); setCreating(true); };
  const onType = (value: string) => {
    const ty = allTypes.find((x) => x.id === Number(value));
    set({ typeId: ty ? ty.id : null, categoryId: ty && ty.punishment_category_id ? (ty.punishment_category_id as CategoryId) : null });
  };

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('incidents.punishments.title', { defaultValue: 'Punitions' })}</h1>
        <div className="alert alert-info" role="alert">{t('incidents.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">
        {t('incidents.punishments.title', { defaultValue: 'Punitions' })} <span className="text-muted" style={{ fontSize: 14 }}>({punishments.length})</span>
      </h1>
      <QueryErrors queries={[punishmentsQuery, typesQuery]} />

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="pun-start" className="form-label">{t('incidents.from', { defaultValue: 'Du' })}</label>
          <input id="pun-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="pun-end" className="form-label">{t('incidents.to', { defaultValue: 'Au' })}</label>
          <input id="pun-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="pun-process" className="form-label">{t('incidents.punishment.state', { defaultValue: 'Traitement' })}</label>
          <select id="pun-process" className="form-control" value={process} onChange={(e) => { setProcess(e.target.value as ProcessFilter); setPage(0); }}>
            <option value="all">{t('incidents.state.all', { defaultValue: 'Tous' })}</option>
            <option value="not">{t('incidents.state.not.processed', { defaultValue: 'Non traités' })}</option>
            <option value="processed">{t('incidents.state.processed', { defaultValue: 'Traités' })}</option>
          </select>
        </div>
        <details data-type-filter>
          <summary>{t('incidents.type', { defaultValue: 'Type' })}{typeIds.length > 0 ? ` (${typeIds.length})` : ''}</summary>
          {allTypes.map((ty) => (
            <label key={ty.id} className="d-block">
              <input type="checkbox" data-type={ty.id} checked={typeIds.includes(ty.id)} onChange={() => { setTypeIds(typeIds.includes(ty.id) ? typeIds.filter((x) => x !== ty.id) : [...typeIds, ty.id]); setPage(0); }} /> {ty.label}
            </label>
          ))}
        </details>
        <span className="ms-auto">
          <a className="btn btn-outline-primary me-8" data-export href={api.punishmentsExportUrl(params)}>{t('incidents.export', { defaultValue: 'Exporter (CSV)' })}</a>
          {canManage && !creating && (
            <button type="button" className="btn btn-primary" data-new-punishment disabled={creatable.length === 0} onClick={openForm}>
              {t('incidents.punishment.new', { defaultValue: 'Nouvelle punition / sanction' })}
            </button>
          )}
        </span>
      </div>

      {created && <div className="alert alert-success" role="status" data-created>{t('incidents.punishment.created', { defaultValue: 'Punition enregistrée.' })}</div>}

      {creating && (
        <form
          className="border rounded p-16 mb-24"
          data-punishment-form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); if (!err) createMut.mutate(); }}
        >
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('incidents.punishment.new', { defaultValue: 'Nouvelle punition / sanction' })}</h2>
          <div className="mb-12">
            <label htmlFor="pun-type" className="form-label">{t('incidents.type', { defaultValue: 'Type' })}</label>
            <select id="pun-type" className="form-control" value={form.typeId ?? ''} onChange={(e) => onType(e.target.value)}>
              <option value="">—</option>
              {creatable.map((ty) => <option key={ty.id} value={ty.id}>{ty.label}</option>)}
            </select>
          </div>
          <div className="mb-12">
            <label htmlFor="pun-student" className="form-label">{t('incidents.student', { defaultValue: 'Élève' })}</label>
            <input id="pun-student" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
            {results.length > 0 && (
              <ul className="list-unstyled border mb-0" data-student-results>
                {results.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="btn btn-link" data-student={s.id} onClick={() => { set({ studentIds: [...form.studentIds, s.id] }); setSearch(''); }}>
                      {s.displayName}{s.classe ? ` (${s.classe})` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="d-flex gap-8 flex-wrap mt-8" data-chosen-students>
              {form.studentIds.map((id) => (
                <span key={id} className="badge bg-secondary">
                  {nameOf(id)}{' '}
                  <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${nameOf(id)}`} onClick={() => set({ studentIds: form.studentIds.filter((x) => x !== id) })}>×</button>
                </span>
              ))}
            </div>
          </div>

          {form.categoryId === 1 && (
            <div className="d-flex gap-12 flex-wrap mb-12">
              <div>
                <label htmlFor="pun-delay" className="form-label">{t('incidents.punishment.delay', { defaultValue: 'À rendre le' })}</label>
                <input id="pun-delay" type="date" className="form-control" value={form.delayDate} onChange={(e) => set({ delayDate: e.target.value })} />
              </div>
              <div className="flex-grow-1">
                <label htmlFor="pun-instruction" className="form-label">{t('incidents.punishment.instruction', { defaultValue: 'Consigne' })}</label>
                <input id="pun-instruction" className="form-control" value={form.instruction} onChange={(e) => set({ instruction: e.target.value })} />
              </div>
            </div>
          )}
          {form.categoryId === 2 && (
            <div className="mb-12" data-slots>
              {form.slots.map((s, i) => (
                <div key={i} className="d-flex gap-12 flex-wrap align-items-end mb-8" data-slot={i}>
                  <div>
                    <label htmlFor={`slot-date-${i}`} className="form-label">{t('incidents.date', { defaultValue: 'Date' })}</label>
                    <input id={`slot-date-${i}`} type="date" className="form-control" value={s.date} onChange={(e) => setSlot(i, { date: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`slot-start-${i}`} className="form-label">{t('incidents.start.time', { defaultValue: 'Début' })}</label>
                    <input id={`slot-start-${i}`} type="time" className="form-control" value={s.startTime} onChange={(e) => setSlot(i, { startTime: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`slot-end-${i}`} className="form-label">{t('incidents.end.time', { defaultValue: 'Fin' })}</label>
                    <input id={`slot-end-${i}`} type="time" className="form-control" value={s.endTime} onChange={(e) => setSlot(i, { endTime: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`slot-place-${i}`} className="form-label">{t('incidents.place', { defaultValue: 'Lieu' })}</label>
                    <select id={`slot-place-${i}`} className="form-control" value={s.place} onChange={(e) => setSlot(i, { place: e.target.value })}>
                      <option value="">—</option>
                      {places.map((p) => <option key={p.id} value={p.label}>{p.label}</option>)}
                    </select>
                  </div>
                  {form.slots.length > 1 && (
                    <button type="button" className="btn btn-outline-secondary" onClick={() => set({ slots: form.slots.filter((_, j) => j !== i) })}>
                      {t('incidents.slot.remove', { defaultValue: 'Retirer ce créneau' })}
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline-primary" data-add-slot onClick={() => set({ slots: [...form.slots, emptySlot()] })}>
                {t('incidents.slot.add', { defaultValue: 'Ajouter un créneau' })}
              </button>
            </div>
          )}
          {form.categoryId === 4 && (
            <div className="d-flex gap-12 flex-wrap align-items-end mb-12">
              <div>
                <label htmlFor="pun-from" className="form-label">{t('incidents.exclusion.from', { defaultValue: "Début de l'exclusion" })}</label>
                <input id="pun-from" type="date" className="form-control" value={form.excludeStart} onChange={(e) => set({ excludeStart: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pun-until" className="form-label">{t('incidents.exclusion.to', { defaultValue: "Fin de l'exclusion" })}</label>
                <input id="pun-until" type="date" className="form-control" value={form.excludeEnd} onChange={(e) => set({ excludeEnd: e.target.value })} />
              </div>
              <label>
                <input type="checkbox" checked={form.mandatoryPresence} onChange={(e) => set({ mandatoryPresence: e.target.checked })} /> {t('incidents.exclusion.presence', { defaultValue: "Présence obligatoire dans l'établissement" })}
              </label>
            </div>
          )}
          {form.categoryId && (
            <p className="text-muted">{CATEGORY_LABEL[form.categoryId]}</p>
          )}
          <div className="mb-12">
            <label htmlFor="pun-description" className="form-label">{t('incidents.description', { defaultValue: 'Description' })}</label>
            <textarea id="pun-description" className="form-control" rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          {submitted && err && <div className="alert alert-warning" role="alert" data-form-error>{t(`incidents.punishment.error.${err}`, { defaultValue: FORM_ERRORS[err] })}</div>}
          {createMut.isError && <div className="alert alert-warning" role="alert" data-create-error>{t('incidents.punishment.create.error', { defaultValue: "L'enregistrement a échoué." })}</div>}
          <div className="d-flex gap-12">
            <button type="submit" className="btn btn-primary" data-save disabled={createMut.isPending}>{t('incidents.save', { defaultValue: 'Enregistrer' })}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setCreating(false)}>{t('incidents.cancel', { defaultValue: 'Annuler' })}</button>
          </div>
        </form>
      )}

      {(processMut.isError || deleteMut.isError) && (
        <div className="alert alert-warning" role="alert" data-action-error>{t('incidents.punishment.action.error', { defaultValue: "L'opération a échoué." })}</div>
      )}

      {punishmentsQuery.isLoading && <p>{t('incidents.loading', { defaultValue: 'Chargement…' })}</p>}
      {!punishmentsQuery.isLoading && !punishmentsQuery.isError && punishments.length === 0 && (
        <p className="text-muted">{t('incidents.punishments.empty', { defaultValue: 'Aucune punition sur la période.' })}</p>
      )}
      {punishments.length > 0 && (
        <div style={{ overflowX: 'auto' }} className="mb-24">
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('incidents.date', { defaultValue: 'Date' })}</th>
                <th>{t('incidents.student', { defaultValue: 'Élève' })}</th>
                <th>{t('incidents.type', { defaultValue: 'Type' })}</th>
                <th>{t('incidents.punishment.details', { defaultValue: 'Détail' })}</th>
                <th>{t('incidents.description', { defaultValue: 'Description' })}</th>
                <th>{t('incidents.punishment.processed', { defaultValue: 'Traité' })}</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {punishments.map((p) => (
                <tr key={p.id} data-punishment={p.id}>
                  <td>{dateFr(p.createdAt)}</td>
                  <td>{p.studentName || '—'}</td>
                  <td>{p.typeLabel || '—'}</td>
                  <td>{p.details || '—'}</td>
                  <td>{p.description || '—'}</td>
                  <td>
                    {canManage ? (
                      <input
                        type="checkbox"
                        data-processed={p.id}
                        aria-label={`${t('incidents.punishment.processed', { defaultValue: 'Traité' })} ${p.studentName}`}
                        checked={p.processed}
                        disabled={processMut.isPending}
                        onChange={() => processMut.mutate({ p, value: !p.processed })}
                      />
                    ) : (p.processed ? t('incidents.yes', { defaultValue: 'Oui' }) : t('incidents.no', { defaultValue: 'Non' }))}
                  </td>
                  {canManage && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        data-delete={p.id}
                        disabled={deleteMut.isPending}
                        onClick={() => { if (window.confirm(t('incidents.punishment.delete.confirm', { defaultValue: 'Supprimer cette punition ?' }))) deleteMut.mutate(p); }}
                      >
                        {t('incidents.delete', { defaultValue: 'Supprimer' })}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={!!punishmentsQuery.data?.hasNext} onChange={setPage} />
    </div>
  );
}

export default Punitions;
