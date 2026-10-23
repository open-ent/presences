import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';

/**
 * Recherche d'un élève ou d'une classe (recherche globale du serveur, comme l'AngularJS) : un élève est choisi
 * directement ; une classe affiche ses élèves, dont on en choisit un.
 */
export function StudentOrClassSearch({ id, structureId, onPick }: { id: string; structureId: string; onPick: (studentId: string) => void }) {
  const { t } = useTranslation(['presences', 'common']);
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState<{ id: string; name: string } | null>(null);
  const term = text.trim();
  const searchQuery = useQuery({ queryKey: ['pres', 'cal-global-search', structureId, term], queryFn: () => api.searchGlobal(structureId, term), enabled: !!structureId && term.length >= 2 });
  const membersQuery = useQuery({ queryKey: ['pres', 'cal-class-students', groupId?.id], queryFn: () => api.getCalendarGroupStudents(groupId!.id), enabled: !!groupId });
  const hits = (searchQuery.data ?? []).slice(0, 10);

  return (
    <div>
      <label htmlFor={id} className="form-label">{t('presences.dashboard.search.placeholder', { defaultValue: 'Rechercher un élève ou une classe pour saisir une absence' })}</label>
      <input id={id} className="form-control" autoComplete="off" value={text} onChange={(e) => { setText(e.target.value); setGroupId(null); }} />
      {term.length >= 2 && !groupId && hits.length > 0 && (
        <ul className="list-unstyled border mb-0" data-search-results>
          {hits.map((h) => (
            <li key={`${h.type}-${h.id}`}>
              <button type="button" className="btn btn-link text-start w-100" data-pick={h.id} data-pick-type={h.type}
                onClick={() => { if (h.type === 'USER') { onPick(h.id); setText(''); } else setGroupId({ id: h.id, name: h.displayName }); }}>
                {h.displayName}{h.type === 'USER' && h.groupName ? ` (${h.groupName})` : ''}{h.type === 'GROUP' ? ` — ${t('presences.class', { defaultValue: 'classe' })}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {term.length >= 2 && !searchQuery.isLoading && hits.length === 0 && !groupId && <p className="text-muted mt-4" data-no-result>{t('presences.search.no.result', { defaultValue: 'Aucun résultat.' })}</p>}
      {groupId && (
        <div className="border rounded p-12 mt-8" data-class-students>
          <strong>{groupId.name}</strong>
          {membersQuery.isLoading && <p className="mb-0">{t('presences.loading', { defaultValue: 'Chargement…' })}</p>}
          {membersQuery.isError && <p className="text-danger mb-0" role="alert">{t('presences.error', { defaultValue: 'Une erreur est survenue.' })}</p>}
          <ul className="list-unstyled mb-0 mt-8">
            {[...(membersQuery.data ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })).map((s) => (
              <li key={s.id}><button type="button" className="btn btn-link text-start" data-pick-student={s.id} onClick={() => { onPick(s.id); setText(''); setGroupId(null); }}>{s.displayName}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
