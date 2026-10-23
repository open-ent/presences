import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { Pager } from '../components/Pager';
import { QueryErrors } from '../components/QueryErrors';
import {
  addGroup, addStudent, applyStatuses, collectiveBody, collectiveInstant, collectiveListParams, CollectiveAbsence, CollectiveForm, emptyCollectiveForm,
  exportParams, formFromCollective, isCollectiveValid, isMultiple, isPeriodValid, nbStudentIssues, nbStudentsSubmit, reasonRule, removeAudience, removeStudent, studentIssue,
} from '../collectiveAbsences';
import { useStructure } from '../structure';
import { dateFr, jour, visibleByLabel } from '../utils';

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return jour(d); };

/**
 * Absences collectives (parité IHM AngularJS) : une absence posée d'un coup à des classes ou à des élèves (sortie,
 * voyage…), avec période, motif, régularisation et commentaire ; contrôle des élèves déjà absents sur la période.
 */
export function AbsencesCollectives() {
  const { t } = useTranslation(['presences', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const today = jour(new Date());

  const [start, setStart] = useState(daysAgo(30));
  const [end, setEnd] = useState(today);
  const [classes, setClasses] = useState<PickedAudience[]>([]);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<CollectiveForm | null>(null);
  const [loadedIds, setLoadedIds] = useState<string[]>([]);
  const [freeHours, setFreeHours] = useState(false);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  const names = classes.map((c) => c.name);
  const params = collectiveListParams(start, end, names, page);
  const listQuery = useQuery({ queryKey: ['pres', 'collectives', structureId, params], queryFn: () => api.getCollectives(structureId, params), enabled: !!structureId });
  const reasonsQuery = useQuery({ queryKey: ['pres', 'reasons', structureId], queryFn: () => api.getReasons(structureId), enabled: !!structureId });
  const slotsQuery = useQuery({ queryKey: ['pres', 'time-slots', structureId], queryFn: () => api.getTimeSlots(structureId), enabled: !!structureId && !!form });
  const reasons = visibleByLabel(reasonsQuery.data ?? []).filter((r) => r.reason_type_id === undefined || r.reason_type_id === 1);
  const slots = (slotsQuery.data ?? []).filter((s) => s.startHour && s.endHour).sort((a, b) => a.startHour.localeCompare(b.startHour));
  const items = listQuery.data?.all ?? [];

  useEffect(() => {
    const h = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(h);
  }, [search]);
  const searchQuery = useQuery({ queryKey: ['pres', 'global-search', structureId, term], queryFn: () => api.searchGlobal(structureId, term), enabled: !!form && !!structureId && term.length >= 2 });

  // État « déjà absent / modifié » des élèves de la sélection, sur la période du formulaire.
  const studentIds = form ? [...new Set(form.audiences.flatMap((a) => a.students.map((s) => s.id)))] : [];
  const periodOk = !!form && isPeriodValid(form);
  const statusQuery = useQuery({
    queryKey: ['pres', 'collective-status', structureId, form?.id ?? null, form ? collectiveInstant(form.startDate, form.startTime) : '', form ? collectiveInstant(form.endDate, form.endTime) : '', studentIds.join(',')],
    queryFn: () => api.getCollectiveStatuses(structureId, { startDate: collectiveInstant(form!.startDate, form!.startTime), endDate: collectiveInstant(form!.endDate, form!.endTime), studentIds, collectiveId: form!.id ?? null }),
    enabled: !!form && studentIds.length > 0 && periodOk,
  });
  const audiences = form ? applyStatuses(form.audiences, statusQuery.data ?? []) : [];
  const shown = form ? { ...form, audiences } : null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'collectives'] });
  const saveMut = useMutation({
    mutationFn: () => (form!.id ? api.updateCollective(structureId, form!.id, collectiveBody(shown!, loadedIds)) : api.createCollective(structureId, collectiveBody(shown!, loadedIds))),
    onSuccess: () => { setMessage(form!.id ? t('presences.collective.absences.form.edit.success', { defaultValue: 'Absence collective modifiée.' }) : t('presences.collective.absences.form.create.success', { defaultValue: 'Absence collective créée.' })); setForm(null); invalidate(); },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.deleteCollective(structureId, form!.id as number),
    onSuccess: () => { setMessage(t('presences.collective.absences.form.delete.success', { defaultValue: 'Absence collective supprimée.' })); setForm(null); invalidate(); },
  });
  const removeMut = useMutation({ mutationFn: (ids: string[]) => api.removeFromCollective(structureId, form!.id as number, ids), onSuccess: invalidate });

  const openCreate = () => { setForm(emptyCollectiveForm(today)); setLoadedIds([]); setFreeHours(false); setMessage(''); };
  const openEdit = async (id: number) => {
    const c: CollectiveAbsence = await api.getCollective(structureId, id);
    const { form: f, loadedIds: ids } = formFromCollective(c, reasonsQuery.data ?? []);
    setForm(f);
    setLoadedIds(ids);
    setMessage('');
    // Les horaires qui ne correspondent pas à un créneau passent en saisie libre.
    setFreeHours(!(slots.some((s) => s.startHour.slice(0, 5) === f.startTime) && slots.some((s) => s.endHour.slice(0, 5) === f.endTime)));
  };
  const patch = (p: Partial<CollectiveForm>) => setForm((f) => (f ? { ...f, ...p } : f));
  const pickReason = (v: string) => {
    const id = v === '' ? null : Number(v);
    patch({ reasonId: id, counsellorRegularisation: reasonRule(reasons.find((r) => r.id === id)).counsellorRegularisation });
  };

  const pick = async (hit: { id: string; displayName: string; type: 'USER' | 'GROUP'; groupId?: string; groupName?: string }) => {
    if (!form) return;
    const groupId = hit.type === 'GROUP' ? hit.id : hit.groupId;
    if (!groupId) return;
    const members = await api.getGroupMembers(groupId);
    const students = members.map((m) => ({ id: m.id, displayName: `${m.lastName ?? ''} ${m.firstName ?? ''}`.trim() }));
    const group = { id: groupId, name: hit.type === 'GROUP' ? hit.displayName : (hit.groupName ?? groupId), countStudents: students.length };
    setForm((f) => (f ? { ...f, audiences: hit.type === 'GROUP' ? addGroup(f.audiences, group, students) : addStudent(f.audiences, group, { id: hit.id, displayName: hit.displayName }) } : f));
    setSearch('');
    setTerm('');
  };

  // En modification, retirer un élève ou une classe déjà enregistrés se fait tout de suite côté serveur.
  const dropStudent = (studentId: string) => {
    if (form?.id && loadedIds.includes(studentId)) removeMut.mutate([studentId]);
    setForm((f) => (f ? { ...f, audiences: removeStudent(f.audiences, studentId) } : f));
  };
  const dropAudience = (audienceId: string) => {
    const a = form?.audiences.find((x) => x.id === audienceId);
    if (form?.id && a) { const ids = a.students.filter((s) => loadedIds.includes(s.id)).map((s) => s.id); if (ids.length > 0) removeMut.mutate(ids); }
    setForm((f) => (f ? { ...f, audiences: removeAudience(f.audiences, audienceId) } : f));
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (shown && isCollectiveValid(shown)) saveMut.mutate(); };

  if (init && !structureId) {
    return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;
  }

  const reason = form ? reasons.find((r) => r.id === form.reasonId) : undefined;
  const rule = reasonRule(reason);
  const hits = (searchQuery.data ?? []).filter((h) => !(h.type === 'GROUP' && form?.audiences.some((a) => a.id === h.id))).slice(0, 10);

  return (
    <div>
      <h1 className="mb-16">{t('presences.collective.absences', { defaultValue: 'Absences collectives' })}</h1>
      <QueryErrors queries={[listQuery]} />

      {/* Liste d'abord : filtres et tableau sont masqués le temps de la saisie. */}
      {!(shown && form) && (
        <>
      <div className="d-flex gap-24 flex-wrap align-items-end mb-12">
        <div style={{ minWidth: 260 }}>
          <AudienceSearch id="ca-class" label={t('presences.collective.absences.search.audience', { defaultValue: 'Rechercher une classe' })} structureId={structureId} selected={classes} onChange={(next) => { setClasses(next); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="ca-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="ca-start" type="date" className="form-control" value={start} onChange={(e) => { setStart(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label htmlFor="ca-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="ca-end" type="date" className="form-control" value={end} onChange={(e) => { setEnd(e.target.value); setPage(0); }} />
        </div>
        <span className="ms-auto d-flex gap-8">
          <a className="btn btn-outline-primary" data-export href={`/presences/structures/${structureId}/absences/collectives/export${exportParams(start, end)}`}>{t('presences.export.tocsv', { defaultValue: 'Exporter (CSV)' })}</a>
          <button type="button" className="btn btn-primary" data-new-collective onClick={openCreate}>{t('presences.collective.absences.button.form', { defaultValue: 'Nouvelle absence collective' })}</button>
        </span>
      </div>
        </>
      )}
      {message && <div className="alert alert-success" role="status" data-notice>{message}</div>}

      {shown && form && (
        <form className="border rounded p-16 mb-24" data-collective-form onSubmit={onSubmit}>
          <h2 style={{ fontSize: 18 }} className="mb-12">{form.id ? t('presences.collective.absences.form.edit', { defaultValue: "Modifier l'absence collective" }) : t('presences.collective.absences.button.form', { defaultValue: 'Nouvelle absence collective' })}</h2>

          <div className="mb-12" style={{ maxWidth: 520 }}>
            <label htmlFor="ca-search" className="form-label">{t('presences.collective.absences.search', { defaultValue: 'Ajouter une classe ou un élève' })}</label>
            <input id="ca-search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
            {hits.length > 0 && (
              <ul className="list-unstyled border mb-0" data-search-results>
                {hits.map((h) => (
                  <li key={`${h.type}-${h.id}`}>
                    <button type="button" className="btn btn-link" data-pick={`${h.type}:${h.id}`} onClick={() => pick(h)}>
                      {h.displayName}{h.type === 'USER' && h.groupName ? ` (${h.groupName})` : ''}{h.type === 'GROUP' ? ' — classe' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="d-flex gap-12 flex-wrap align-items-end mb-12">
            <div>
              <label htmlFor="ca-form-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
              <input id="ca-form-start" type="date" className="form-control" value={form.startDate} onChange={(e) => patch({ startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })} />
            </div>
            <div>
              <label htmlFor="ca-form-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
              <input id="ca-form-end" type="date" min={form.startDate} className="form-control" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
            </div>
            <label className="mb-8"><input type="checkbox" data-free-hours checked={freeHours} onChange={(e) => setFreeHours(e.target.checked)} /> {t('presences.free.schedule', { defaultValue: 'Horaires libres' })}</label>
            {freeHours ? (
              <>
                <div>
                  <label htmlFor="ca-start-time" className="form-label">{t('presences.as.of', { defaultValue: 'À partir de' })}</label>
                  <input id="ca-start-time" type="time" className="form-control" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="ca-end-time" className="form-label">{t('presences.until', { defaultValue: "Jusqu'à" })}</label>
                  <input id="ca-end-time" type="time" className="form-control" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="ca-slot-start" className="form-label">{t('presences.slot.from', { defaultValue: 'À partir du créneau' })}</label>
                  <select id="ca-slot-start" className="form-control" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })}>
                    {slots.map((s) => <option key={s.id} value={s.startHour.slice(0, 5)}>{s.name} ({s.startHour.slice(0, 5)})</option>)}
                    {!slots.some((s) => s.startHour.slice(0, 5) === form.startTime) && <option value={form.startTime}>{form.startTime}</option>}
                  </select>
                </div>
                <div>
                  <label htmlFor="ca-slot-end" className="form-label">{t('presences.slot.to', { defaultValue: "Jusqu'au créneau" })}</label>
                  <select id="ca-slot-end" className="form-control" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })}>
                    {slots.map((s) => <option key={s.id} value={s.endHour.slice(0, 5)}>{s.name} ({s.endHour.slice(0, 5)})</option>)}
                    {!slots.some((s) => s.endHour.slice(0, 5) === form.endTime) && <option value={form.endTime}>{form.endTime}</option>}
                  </select>
                </div>
              </>
            )}
          </div>
          {!isPeriodValid(form) && <div className="alert alert-warning" role="alert" data-period-error>{t('presences.collective.absences.period.error', { defaultValue: "La fin de l'absence doit suivre son début." })}</div>}

          <div className="d-flex gap-12 flex-wrap align-items-end mb-12">
            <div>
              <label htmlFor="ca-reason" className="form-label">{t('presences.collective.absences.reason', { defaultValue: 'Motif' })}</label>
              <select id="ca-reason" className="form-control" value={form.reasonId ?? ''} onChange={(e) => pickReason(e.target.value)}>
                <option value="">{t('presences.absence.select.empty', { defaultValue: 'Sans motif' })}</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <label className="mb-8">
              <input type="checkbox" data-regularized checked={form.counsellorRegularisation} disabled={!rule.canRegularize} onChange={(e) => patch({ counsellorRegularisation: e.target.checked })} /> {t('presences.collective.absences.regularized', { defaultValue: 'Régularisée' })}
            </label>
            <div className="flex-grow-1">
              <label htmlFor="ca-comment" className="form-label">{t('presences.collective.absences.comment', { defaultValue: 'Commentaire' })}</label>
              <input id="ca-comment" className="form-control" value={form.comment} onChange={(e) => patch({ comment: e.target.value })} />
            </div>
          </div>

          {audiences.length > 0 && (
            <div className="mb-12" data-audiences>
              <p className="text-muted mb-8" data-summary>
                {nbStudentsSubmit(audiences)} {t('presences.collective.absences.students.submit', { defaultValue: 'élève(s) concerné(s)' })}
                {nbStudentIssues(audiences) > 0 && <> · <span data-issues>{nbStudentIssues(audiences)} {t('presences.collective.absences.issues', { defaultValue: 'avec un problème' })}</span></>}
              </p>
              {audiences.map((a) => (
                <div key={a.id} className="border rounded mb-8" data-audience={a.id}>
                  <div className="d-flex justify-content-between align-items-center p-8">
                    <button type="button" className="btn btn-link p-0" aria-expanded={open[a.id] ?? true} onClick={() => setOpen({ ...open, [a.id]: !(open[a.id] ?? true) })}>
                      {(open[a.id] ?? true) ? '▾' : '▸'} {a.name}
                    </button>
                    <span>{a.students.length}/{a.countStudents ?? a.students.length}
                      <button type="button" className="btn btn-link text-danger" data-drop-audience={a.id} aria-label={`Retirer la classe ${a.name}`} onClick={() => dropAudience(a.id)}>✕</button>
                    </span>
                  </div>
                  {(open[a.id] ?? true) && (
                    <ul className="list-unstyled mb-0 px-8 pb-8">
                      {a.students.map((s) => {
                        const dup = isMultiple(audiences, a.id, s.id);
                        return (
                          <li key={s.id} className={`d-flex gap-12 align-items-center py-4${dup ? ' text-muted' : ''}`} data-student={s.id}>
                            <span className="flex-grow-1">{s.displayName}</span>
                            <span data-issue>{dup ? t('presences.collective.absences.already.taken.into.account', { defaultValue: 'Déjà pris en compte' }) : studentIssue(s)}</span>
                            {!dup && <button type="button" className="btn btn-link text-danger p-0" data-drop-student={s.id} aria-label={`Retirer ${s.displayName}`} onClick={() => dropStudent(s.id)}>✕</button>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {(saveMut.isError || deleteMut.isError || removeMut.isError) && <div className="alert alert-warning" role="alert" data-form-error>{t('presences.collective.absences.form.error', { defaultValue: "L'opération a échoué." })}</div>}
          <div className="d-flex gap-12">
            <button type="submit" className="btn btn-primary" data-save disabled={!isCollectiveValid(shown) || saveMut.isPending}>{t('presences.exemptions.form.submit', { defaultValue: 'Valider' })}</button>
            <button type="button" className="btn btn-outline-secondary" data-cancel onClick={() => setForm(null)}>{t('presences.cancel', { defaultValue: 'Annuler' })}</button>
            {form.id && (
              <button type="button" className="btn btn-outline-danger ms-auto" data-delete disabled={deleteMut.isPending} onClick={() => { if (window.confirm(t('presences.collective.absences.delete.confirm', { defaultValue: 'Supprimer cette absence collective ?' }))) deleteMut.mutate(); }}>
                {t('presences.delete', { defaultValue: 'Supprimer' })}
              </button>
            )}
          </div>
        </form>
      )}

      {!(shown && form) && (
        <>
      {listQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && <p className="text-muted" data-empty>{t('presences.collective.absences.empty', { defaultValue: 'Aucune absence collective sur la période.' })}</p>}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-hover table-bordered mb-0" data-collective-table>
            <thead>
              <tr>
                <th>{t('presences.collective.absences.audience', { defaultValue: 'Classes' })}</th>
                <th>{t('presences.collective.absences.total.number', { defaultValue: 'Élèves' })}</th>
                <th>{t('presences.collective.absences.dates', { defaultValue: 'Dates' })}</th>
                <th>{t('presences.collective.absences.reason', { defaultValue: 'Motif' })}</th>
                <th>{t('presences.collective.absences.comment', { defaultValue: 'Commentaire' })}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} data-collective={c.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(c.id)}>
                  <td>{c.audiences.map((a) => a.name).join(', ')}</td>
                  <td className="text-center">{c.countStudent ?? ''}</td>
                  <td>{dateFr(c.startDate)} → {dateFr(c.endDate)}</td>
                  <td>{c.reason?.label ?? '—'}</td>
                  <td>{c.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={items.length >= 20 || (listQuery.data?.page_count ?? 1) > page + 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default AbsencesCollectives;
