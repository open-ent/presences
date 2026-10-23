import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { AudienceSearch, PickedAudience } from '../components/AudienceSearch';
import { QueryErrors } from '../components/QueryErrors';
import { PickedStudent, StudentSearch } from '../components/StudentSearch';
import { addStudents, emptyPresenceForm, formFromPresence, groupByDay, PresenceFilters, PresenceForm, presenceError, presenceParams, PresenceRecord, studentsLabel } from '../presenceList';
import { useRights } from '../rights';
import { useStructure } from '../structure';
import { dateFr, heure, jour } from '../utils';

const ERRORS: Record<string, string> = {
  discipline: 'Choisissez une discipline.',
  students: 'Choisissez au moins un élève.',
  times: "L'heure de fin doit suivre l'heure de début.",
};

const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return jour(d); };

/**
 * Présences saisies (1er degré, parité IHM AngularJS) : élèves déclarés présents sur un créneau, regroupés par jour ;
 * filtres (période, élèves, classes, auteurs, « mes présences »), création, modification, suppression et export CSV.
 */
export function PresencesSaisies() {
  const { t } = useTranslation(['presences', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const { structureId } = useStructure();
  const rights = useRights();
  const userId = user?.userId ?? '';

  const [start, setStart] = useState(monthAgo());
  const [end, setEnd] = useState(jour(new Date()));
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [classes, setClasses] = useState<PickedAudience[]>([]);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [ownerText, setOwnerText] = useState('');
  const [ownerTerm, setOwnerTerm] = useState('');
  const [mine, setMine] = useState(false);
  const [form, setForm] = useState<PresenceForm | null>(null);
  const [freeHours, setFreeHours] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [addText, setAddText] = useState('');
  const [addTerm, setAddTerm] = useState('');

  const filters: PresenceFilters = { structureId, start, end, studentIds: students.map((s) => s.id), ownerIds: owners.map((o) => o.id), audienceIds: classes.map((c) => c.id), mine };
  const params = presenceParams(filters, userId);
  const listQuery = useQuery({ queryKey: ['pres', 'presence-list', structureId, params], queryFn: () => api.getPresenceList(params), enabled: !!structureId });
  const disciplinesQuery = useQuery({ queryKey: ['pres', 'disciplines', structureId], queryFn: () => api.getDisciplines(structureId), enabled: !!structureId && !!form });
  const slotsQuery = useQuery({ queryKey: ['pres', 'time-slots', structureId], queryFn: () => api.getTimeSlots(structureId), enabled: !!structureId && !!form });
  const days = groupByDay(listQuery.data ?? []);
  const slots = (slotsQuery.data ?? []).filter((s) => s.startHour && s.endHour).sort((a, b) => a.startHour.localeCompare(b.startHour));
  const disciplines = (disciplinesQuery.data ?? []).filter((d) => !d.hidden);

  useEffect(() => { const h = setTimeout(() => setOwnerTerm(ownerText.trim()), 250); return () => clearTimeout(h); }, [ownerText]);
  useEffect(() => { const h = setTimeout(() => setAddTerm(addText.trim()), 250); return () => clearTimeout(h); }, [addText]);
  const ownersQuery = useQuery({ queryKey: ['pres', 'staff-search', structureId, ownerTerm], queryFn: () => api.searchStaff(structureId, ownerTerm), enabled: !!structureId && ownerTerm.length >= 2 });
  const addQuery = useQuery({ queryKey: ['pres', 'global-search', structureId, addTerm], queryFn: () => api.searchGlobal(structureId, addTerm), enabled: !!form && !!structureId && addTerm.length >= 2 });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pres', 'presence-list'] });
  const saveMut = useMutation({
    mutationFn: () => api.savePresence(form!),
    onSuccess: () => { setMessage(form!.id ? t('presences.presences.form.edit.succeed', { defaultValue: 'Présence modifiée.' }) : t('presences.presences.form.create.succeed', { defaultValue: 'Présence créée.' })); setForm(null); setSubmitted(false); invalidate(); },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.deletePresence(form!.id as number),
    onSuccess: () => { setMessage(t('presences.presences.form.delete.succeed', { defaultValue: 'Présence supprimée.' })); setForm(null); invalidate(); },
  });

  const patch = (p: Partial<PresenceForm>) => setForm((f) => (f ? { ...f, ...p } : f));
  const openCreate = () => { setForm(emptyPresenceForm(structureId, jour(new Date()), { id: userId, displayName: user?.username ?? '' })); setFreeHours(false); setSubmitted(false); setMessage(''); };
  const openEdit = (p: PresenceRecord) => {
    if (!rights.managePresencesList) return;
    const f = formFromPresence(p);
    setForm(f);
    setFreeHours(!(slots.some((s) => s.startHour.slice(0, 5) === f.startTime) && slots.some((s) => s.endHour.slice(0, 5) === f.endTime)));
    setSubmitted(false);
    setMessage('');
  };
  const err = form ? presenceError(form) : null;
  const onSubmit = (e: FormEvent) => { e.preventDefault(); setSubmitted(true); if (!err) saveMut.mutate(); };

  const pick = async (hit: { id: string; displayName: string; type: 'USER' | 'GROUP'; groupName?: string }) => {
    if (hit.type === 'USER') patch({ students: addStudents(form!.students, [{ id: hit.id, displayName: hit.displayName, classeName: hit.groupName, comment: '' }]) });
    else {
      const members = await api.getGroupMembers(hit.id);
      setForm((f) => (f ? { ...f, students: addStudents(f.students, members.map((m) => ({ id: m.id, displayName: `${m.lastName ?? ''} ${m.firstName ?? ''}`.trim(), classeName: hit.displayName, comment: '' }))) } : f));
    }
    setAddText('');
    setAddTerm('');
  };
  const setComment = (id: string, comment: string) => form && patch({ students: form.students.map((s) => (s.id === id ? { ...s, comment } : s)) });

  if (init && !structureId) return <div className="alert alert-info" role="alert">{t('presences.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>;

  const total = (listQuery.data ?? []).length;

  return (
    <div>
      <h1 className="mb-16">{t('presences.presences.title', { defaultValue: 'Présences' })}</h1>
      <QueryErrors queries={[listQuery]} />

      <div className="d-flex gap-24 flex-wrap mb-12">
        <div style={{ minWidth: 240 }}>
          <StudentSearch id="ps-student" label={t('presences.exemptions.search.student', { defaultValue: 'Rechercher un élève' })} structureId={structureId} selected={students} onAdd={(s) => setStudents([...students, s])} onRemove={(s) => setStudents(students.filter((x) => x.id !== s.id))} />
        </div>
        <div style={{ minWidth: 240 }}>
          <AudienceSearch id="ps-class" label={t('presences.exemptions.search.audience', { defaultValue: 'Rechercher une classe' })} structureId={structureId} selected={classes} onChange={setClasses} />
        </div>
        <div style={{ minWidth: 240 }}>
          <label htmlFor="ps-owner" className="form-label">{t('presences.presences.search.user', { defaultValue: 'Rechercher un auteur' })}</label>
          <input id="ps-owner" className="form-control" value={ownerText} onChange={(e) => setOwnerText(e.target.value)} autoComplete="off" />
          {ownerText.trim().length >= 2 && (ownersQuery.data ?? []).filter((o) => !owners.some((x) => x.id === o.id)).length > 0 && (
            <ul className="list-unstyled border mb-0" data-owner-results>
              {(ownersQuery.data ?? []).filter((o) => !owners.some((x) => x.id === o.id)).slice(0, 10).map((o) => (
                <li key={o.id}><button type="button" className="btn btn-link" data-pick-owner={o.id} onClick={() => { setOwners([...owners, { id: o.id, name: o.displayName }]); setOwnerText(''); setOwnerTerm(''); }}>{o.displayName}</button></li>
              ))}
            </ul>
          )}
          <div className="d-flex gap-8 flex-wrap mt-8" data-chosen-owners>
            {owners.map((o) => <span key={o.id} className="badge bg-secondary">{o.name} <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${o.name}`} onClick={() => setOwners(owners.filter((x) => x.id !== o.id))}>×</button></span>)}
          </div>
        </div>
      </div>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="ps-start" className="form-label">{t('presences.from', { defaultValue: 'Du' })}</label>
          <input id="ps-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ps-end" className="form-label">{t('presences.to', { defaultValue: 'Au' })}</label>
          <input id="ps-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <label className="mb-8"><input type="checkbox" data-mine checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t('presences.presences.mine', { defaultValue: 'Mes présences' })}</label>
        <span className="ms-auto d-flex gap-8">
          <a className={`btn btn-outline-primary${total === 0 || total > 1000 ? ' disabled' : ''}`} data-export aria-disabled={total === 0 || total > 1000} href={total === 0 || total > 1000 ? undefined : `/presences/presences/export${params}`}>{t('presences.export.tocsv', { defaultValue: 'Exporter (CSV)' })}</a>
          {rights.managePresencesList && <button type="button" className="btn btn-primary" data-new-presence onClick={openCreate}>{t('presences.presences.form', { defaultValue: 'Saisir une présence' })}</button>}
        </span>
      </div>
      {total > 1000 && <p className="text-muted">{t('presences.presences.csv.full', { defaultValue: "Trop de présences pour l'export : réduisez la période." })}</p>}
      {message && <div className="alert alert-success" role="status" data-notice>{message}</div>}

      {form && (
        <form className="border rounded p-16 mb-24" data-presence-form onSubmit={onSubmit}>
          <h2 style={{ fontSize: 18 }} className="mb-12">{form.id ? t('presences.presences.form.edit', { defaultValue: 'Modifier la présence' }) : t('presences.presences.form', { defaultValue: 'Saisir une présence' })}</h2>
          <p className="text-muted" data-owner>{t('presences.created.by', { defaultValue: 'Saisie par' })} {form.owner.displayName}</p>
          <div className="d-flex gap-12 flex-wrap align-items-end mb-12">
            <div>
              <label htmlFor="ps-form-date" className="form-label">{t('presences.date', { defaultValue: 'Date' })}</label>
              <input id="ps-form-date" type="date" className="form-control" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            </div>
            <label className="mb-8"><input type="checkbox" data-free-hours checked={freeHours} onChange={(e) => setFreeHours(e.target.checked)} /> {t('presences.free.schedule', { defaultValue: 'Horaires libres' })}</label>
            {freeHours ? (
              <>
                <div><label htmlFor="ps-start-time" className="form-label">{t('presences.as.of', { defaultValue: 'À partir de' })}</label><input id="ps-start-time" type="time" className="form-control" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} /></div>
                <div><label htmlFor="ps-end-time" className="form-label">{t('presences.until', { defaultValue: "Jusqu'à" })}</label><input id="ps-end-time" type="time" className="form-control" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} /></div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="ps-slot-start" className="form-label">{t('presences.slot.from', { defaultValue: 'À partir du créneau' })}</label>
                  <select id="ps-slot-start" className="form-control" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })}>
                    <option value="">—</option>
                    {slots.map((s) => <option key={s.id} value={s.startHour.slice(0, 5)}>{s.name} ({s.startHour.slice(0, 5)})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ps-slot-end" className="form-label">{t('presences.slot.to', { defaultValue: "Jusqu'au créneau" })}</label>
                  <select id="ps-slot-end" className="form-control" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })}>
                    <option value="">—</option>
                    {slots.map((s) => <option key={s.id} value={s.endHour.slice(0, 5)}>{s.name} ({s.endHour.slice(0, 5)})</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label htmlFor="ps-discipline" className="form-label">{t('presences.presences.discipline', { defaultValue: 'Discipline' })}</label>
              <select id="ps-discipline" className="form-control" value={form.disciplineId ?? ''} onChange={(e) => patch({ disciplineId: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">—</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-12" style={{ maxWidth: 520 }}>
            <label htmlFor="ps-add" className="form-label">{t('presences.presences.add', { defaultValue: 'Ajouter une classe ou un élève' })}</label>
            <input id="ps-add" className="form-control" value={addText} onChange={(e) => setAddText(e.target.value)} autoComplete="off" />
            {addText.trim().length >= 2 && (addQuery.data ?? []).length > 0 && (
              <ul className="list-unstyled border mb-0" data-search-results>
                {(addQuery.data ?? []).slice(0, 10).map((h) => (
                  <li key={`${h.type}-${h.id}`}><button type="button" className="btn btn-link" data-pick-add={`${h.type}:${h.id}`} onClick={() => pick(h)}>{h.displayName}{h.type === 'USER' && h.groupName ? ` (${h.groupName})` : ''}{h.type === 'GROUP' ? ' — classe' : ''}</button></li>
                ))}
              </ul>
            )}
          </div>
          {form.students.length > 0 && (
            <ul className="list-unstyled mb-12" data-marked-students>
              {form.students.map((s) => (
                <li key={s.id} className="d-flex gap-12 align-items-center py-4" data-marked={s.id}>
                  <span style={{ minWidth: 200 }}>{s.displayName}{s.classeName ? <span className="text-muted"> {s.classeName}</span> : null}</span>
                  <input className="form-control" aria-label={`${t('presences.comment', { defaultValue: 'Commentaire' })} ${s.displayName}`} data-comment={s.id} value={s.comment} onChange={(e) => setComment(s.id, e.target.value)} />
                  <button type="button" className="btn btn-link text-danger p-0" aria-label={`Retirer ${s.displayName}`} data-remove={s.id} onClick={() => patch({ students: form.students.filter((x) => x.id !== s.id) })}>✕</button>
                </li>
              ))}
            </ul>
          )}
          {submitted && err && <div className="alert alert-warning" role="alert" data-form-error>{t(`presences.presences.error.${err}`, { defaultValue: ERRORS[err] })}</div>}
          {(saveMut.isError || deleteMut.isError) && <div className="alert alert-warning" role="alert" data-save-error>{t('presences.presences.form.error', { defaultValue: "L'enregistrement a échoué." })}</div>}
          <div className="d-flex gap-12">
            <button type="submit" className="btn btn-primary" data-save disabled={saveMut.isPending}>{t('presences.exemptions.form.submit', { defaultValue: 'Valider' })}</button>
            <button type="button" className="btn btn-outline-secondary" data-cancel onClick={() => setForm(null)}>{t('presences.cancel', { defaultValue: 'Annuler' })}</button>
            {form.id && <button type="button" className="btn btn-outline-danger ms-auto" data-delete disabled={deleteMut.isPending} onClick={() => { if (window.confirm(t('presences.presences.delete.confirm', { defaultValue: 'Supprimer cette présence ?' }))) deleteMut.mutate(); }}>{t('presences.delete', { defaultValue: 'Supprimer' })}</button>}
          </div>
        </form>
      )}

      {listQuery.isLoading && <p>{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
      {!listQuery.isLoading && !listQuery.isError && total === 0 && <p className="text-muted" data-empty>{t('presences.presences.empty', { defaultValue: 'Aucune présence sur la période.' })}</p>}
      {days.map((d) => (
        <section key={d.day} className="mb-16" data-day={d.day}>
          <h2 style={{ fontSize: 16 }} className="mb-8">{dateFr(d.day)}</h2>
          <div className="d-flex gap-12 flex-wrap">
            {d.items.map((p) => (
              <button key={p.id} type="button" className="card p-12 text-start" data-presence={p.id} style={{ minWidth: 220, cursor: rights.managePresencesList ? 'pointer' : 'default' }} onClick={() => openEdit(p)}>
                <strong>{heure(p.startDate)} – {heure(p.endDate)}</strong>
                <span>{p.owner?.displayName}</span>
                <em className="text-muted">{p.discipline?.label}</em>
                <span>{studentsLabel(p.markedStudents.length)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default PresencesSaisies;
