import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, Channel, MASSMAILING_TYPES, MassmailingType, Waiting } from '../api';
import { QueryErrors } from '../components/QueryErrors';
import { channelLabel, initialSelection, messageCount, sendBody, templateCategory } from '../sending';
import { useStructure } from '../structure';
import { schoolYear, totalCount, typeLabel } from '../utils';

const CHANNELS: Channel[] = ['MAIL', 'SMS', 'PDF'];

/**
 * Publipostage — parité IHM AngularJS (CCTP 51C) : choix du canal (courriel, SMS, courrier PDF), du type d'événement,
 * du seuil et de la période, synthèse (événements, élèves contactables, anomalies de coordonnées), puis ENVOI : modèle
 * de message, destinataires cochés élève par élève, confirmation. Courriel et SMS partent en tâche de fond ; le courrier
 * produit un PDF téléchargé.
 */
export function Publipostage() {
  const { t } = useTranslation(['massmailing', 'common']);
  const { init } = useEdificeClient();
  const { structureId } = useStructure();

  const [channel, setChannel] = useState<Channel>('MAIL');
  const [type, setType] = useState<MassmailingType>('UNREGULARIZED');
  const [waiting, setWaiting] = useState<Waiting>('waiting');
  const [startAt, setStartAt] = useState(1);
  const [start, setStart] = useState(schoolYear().start);
  const [end, setEnd] = useState(schoolYear().end);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<Channel | null>(null);

  const key = [structureId, type, startAt, start, end, waiting] as const;
  const statusQuery = useQuery({ queryKey: ['mm', 'status', ...key], queryFn: () => api.getStatus(structureId, type, startAt, start, end, waiting), enabled: !!structureId });
  const prefetchQuery = useQuery({
    queryKey: ['mm', 'prefetch', channel, ...key],
    queryFn: () => api.getPrefetch(channel, structureId, type, startAt, start, end, waiting),
    enabled: !!structureId,
  });
  const anomaliesQuery = useQuery({ queryKey: ['mm', 'anomalies', ...key], queryFn: () => api.getAnomalies(structureId, type, startAt, start, end, waiting), enabled: !!structureId });
  const templatesQuery = useQuery({
    queryKey: ['mm', 'templates', structureId, channel, templateCategory(type)],
    queryFn: () => api.getTemplates(channel, structureId, templateCategory(type)),
    enabled: !!structureId,
  });

  const status = statusQuery.data ?? 0;
  const prefetch = prefetchQuery.data;
  const anomalies = anomaliesQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  // Chaque nouveau préchargement repart de la sélection par défaut (tous les élèves, responsable principal).
  useEffect(() => {
    if (prefetch) setSelection(initialSelection(prefetch.students));
    setSent(null);
  }, [prefetch]);
  // Le premier modèle de la catégorie est proposé (comme l'AngularJS) ; un modèle qui n'existe plus est abandonné.
  useEffect(() => {
    if (templates.length > 0 && !templates.some((m) => m.id === templateId)) setTemplateId(templates[0].id);
    if (templates.length === 0) setTemplateId(null);
  }, [templates, templateId]);

  const count = messageCount(selection);
  const send = useMutation({
    mutationFn: async () => {
      const body = sendBody({ structureId, type, templateId: templateId!, startAt, start, end, waiting, selection });
      const res = await api.sendMassmailing(channel, body);
      if (res.file) {
        const url = URL.createObjectURL(res.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName ?? 'publipostage.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => {
      setConfirming(false);
      setSent(channel);
    },
    onError: () => setConfirming(false),
  });

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('massmailing.title', { defaultValue: 'Publipostage' })}</h1>
        <div className="alert alert-info" role="alert">{t('massmailing.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  const toggleRecipient = (studentId: string, relativeId: string, on: boolean) =>
    setSelection((s) => ({ ...s, [studentId]: on ? [...(s[studentId] ?? []), relativeId] : (s[studentId] ?? []).filter((id) => id !== relativeId) }));

  return (
    <div>
      <h1 className="mb-16">{t('massmailing.title', { defaultValue: 'Publipostage' })}</h1>
      <QueryErrors queries={[statusQuery, prefetchQuery, anomaliesQuery]} />

      {/* Canal */}
      <div className="btn-group mb-16" role="group" aria-label={t('massmailing.channel', { defaultValue: "Canal d'envoi" })}>
        {CHANNELS.map((c) => (
          <button key={c} type="button" className={`btn btn-${channel === c ? 'primary' : 'secondary'}`} aria-pressed={channel === c} onClick={() => setChannel(c)} data-channel={c}>
            {t(`massmailing.channel.${c}`, { defaultValue: channelLabel(c) })}
          </button>
        ))}
      </div>

      {/* Filtres : type d'événement + statut + seuil + période */}
      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div>
          <label htmlFor="mm-type" className="form-label">{t('massmailing.event.type', { defaultValue: "Type d'événement" })}</label>
          <select id="mm-type" className="form-select" value={type} onChange={(e) => setType(e.target.value as MassmailingType)}>
            {MASSMAILING_TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mm-waiting" className="form-label">{t('massmailing.waiting', { defaultValue: 'Statut' })}</label>
          <select id="mm-waiting" className="form-select" value={waiting} onChange={(e) => setWaiting(e.target.value as Waiting)}>
            <option value="waiting">{t('massmailing.waiting.waiting', { defaultValue: 'À publiposter' })}</option>
            <option value="mailed">{t('massmailing.waiting.mailed', { defaultValue: 'Déjà publipostés' })}</option>
            <option value="all">{t('massmailing.waiting.all', { defaultValue: 'Tous' })}</option>
          </select>
        </div>
        <div>
          <label htmlFor="mm-seuil" className="form-label">{t('massmailing.threshold', { defaultValue: 'À partir de (seuil)' })}</label>
          <input id="mm-seuil" type="number" min={1} className="form-control" style={{ width: 110 }} value={startAt} onChange={(e) => setStartAt(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div>
          <label htmlFor="mm-start" className="form-label">{t('massmailing.from', { defaultValue: 'Du' })}</label>
          <input id="mm-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mm-end" className="form-label">{t('massmailing.to', { defaultValue: 'Au' })}</label>
          <input id="mm-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {/* Synthèse */}
      <div className="d-flex gap-16 flex-wrap mb-24">
        <div className="card p-16 text-center" style={{ minWidth: 180, flexGrow: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{status}</div>
          <div className="text-muted">{t('massmailing.status.count', { defaultValue: 'Événement(s) sur la période' })}</div>
        </div>
        <div className="card p-16 text-center" style={{ minWidth: 180, flexGrow: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{prefetch?.counts.students ?? 0}</div>
          <div className="text-muted">{t('massmailing.students.contactable', { defaultValue: 'Élève(s) contactable(s)' })} · {t(`massmailing.channel.${channel}`, { defaultValue: channelLabel(channel) })}</div>
        </div>
        <div className="card p-16 text-center" style={{ minWidth: 180, flexGrow: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: anomalies.length > 0 ? '#c0392b' : undefined }}>{anomalies.length}</div>
          <div className="text-muted">{t('massmailing.anomalies', { defaultValue: 'Anomalie(s) de coordonnées' })}</div>
        </div>
      </div>

      {(statusQuery.isLoading || prefetchQuery.isLoading) && <p>{t('massmailing.loading', { defaultValue: 'Chargement…' })}</p>}

      {/* Élèves à publiposter, destinataires cochés */}
      {(prefetch?.students.length ?? 0) > 0 && (
        <section className="mb-24" data-recipients>
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('massmailing.students.title', { defaultValue: 'Élèves à publiposter' })}</h2>
          <table className="table table-bordered mb-12">
            <thead>
              <tr>
                <th>{t('massmailing.student', { defaultValue: 'Élève' })}</th>
                <th>{t('massmailing.class', { defaultValue: 'Classe' })}</th>
                <th className="text-center">{t('massmailing.count', { defaultValue: "Nombre d'événements" })}</th>
                <th>{t('massmailing.recipients', { defaultValue: 'Destinataires' })}</th>
              </tr>
            </thead>
            <tbody>
              {prefetch!.students.map((s) => (
                <tr key={s.id} data-student={s.id}>
                  <td>{s.displayName ?? '—'}</td>
                  <td>{s.className ?? '—'}</td>
                  <td className="text-center">{totalCount(s.count)}</td>
                  <td>
                    {(s.relative ?? []).length === 0 && <span className="text-muted">—</span>}
                    {(s.relative ?? []).map((r) => (
                      <div key={r.id} className="form-check">
                        <input
                          id={`rel-${s.id}-${r.id}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={(selection[s.id] ?? []).includes(r.id)}
                          onChange={(e) => toggleRecipient(s.id, r.id, e.target.checked)}
                        />
                        <label htmlFor={`rel-${s.id}-${r.id}`} className="form-check-label">
                          {r.displayName ?? r.id}
                          {(r.contact ?? r.address) && <span className="text-muted"> · {r.contact ?? r.address}</span>}
                        </label>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Envoi */}
          <div className="card p-16 d-flex flex-wrap gap-12 align-items-end" data-send-panel>
            <div>
              <label htmlFor="mm-template" className="form-label">{t('massmailing.template', { defaultValue: 'Modèle de message' })}</label>
              <select id="mm-template" className="form-select" value={templateId ?? ''} onChange={(e) => setTemplateId(Number(e.target.value))} disabled={templates.length === 0}>
                {templates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-primary" disabled={templateId === null || count === 0 || send.isPending} onClick={() => setConfirming(true)} data-send>
              {t('massmailing.send', { defaultValue: 'Envoyer' })} ({count})
            </button>
            {templates.length === 0 && !templatesQuery.isLoading && !templatesQuery.isError && (
              <span className="text-danger">{t('massmailing.no.template', { defaultValue: "Aucun modèle de message pour ce canal et ce type : créez-en un dans les paramètres du publipostage." })}</span>
            )}
          </div>
          {confirming && (
            <div className="alert alert-warning mt-12" role="alertdialog" aria-label={t('massmailing.confirm.title', { defaultValue: "Confirmer l'envoi" })} data-confirm>
              {t('massmailing.confirm', { defaultValue: 'Envoyer [[count]] message(s) par [[channel]] ? Cette action ne peut pas être annulée.', count, channel: channelLabel(channel).toLowerCase() })}{' '}
              <button type="button" className="btn btn-danger btn-sm ms-8" disabled={send.isPending} onClick={() => send.mutate()} data-confirm-send>
                {t('massmailing.confirm.yes', { defaultValue: 'Confirmer' })}
              </button>{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)}>{t('massmailing.cancel', { defaultValue: 'Annuler' })}</button>
            </div>
          )}
          {send.isError && (
            <div className="alert alert-danger mt-12" role="alert" data-send-error>
              {t('massmailing.send.error', { defaultValue: "Le publipostage n'a pas pu être lancé : aucun message n'est parti. Réessayez." })}
            </div>
          )}
          {sent && (
            <div className="alert alert-success mt-12" role="status" data-sent>
              {sent === 'PDF'
                ? t('massmailing.sent.pdf', { defaultValue: 'Le courrier est généré : le PDF est téléchargé.' })
                : t('massmailing.sent', { defaultValue: "Le publipostage est lancé : les messages partent en tâche de fond, l'historique les liste au fur et à mesure." })}
            </div>
          )}
        </section>
      )}

      {/* Anomalies : élèves sans coordonnées valides */}
      {anomalies.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('massmailing.anomalies.title', { defaultValue: 'Anomalies (coordonnées manquantes)' })}</h2>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('massmailing.student', { defaultValue: 'Élève' })}</th>
                <th>{t('massmailing.class', { defaultValue: 'Classe' })}</th>
                <th className="text-center">{t('massmailing.count', { defaultValue: "Nombre d'événements" })}</th>
                <th>{t('massmailing.missing.channel', { defaultValue: 'Canal manquant' })}</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id}>
                  <td>{a.displayName ?? '—'}</td>
                  <td>{a.className ?? '—'}</td>
                  <td className="text-center">{totalCount(a.count)}</td>
                  <td>{Object.entries(a.bug ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {status === 0 && !statusQuery.isLoading && !statusQuery.isError && (
        <p className="text-muted">{t('massmailing.empty', { defaultValue: 'Aucun événement à publiposter sur la période.' })}</p>
      )}
    </div>
  );
}

export default Publipostage;
