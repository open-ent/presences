import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../api';

export interface PickedStudent { id: string; name: string; classe?: string }

/**
 * Recherche d'élève côté serveur (`/presences/search/students`, comme l'AngularJS) : au moins deux lettres, résultats
 * limités aux élèves que le compte a le droit de voir. Les élèves choisis s'affichent en puces (un seul en mode `single`).
 * Les attributs `data-*` des résultats et des puces sont réglables pour les tests des écrans.
 */
export function StudentSearch({
  id, label, structureId, selected, onAdd, onRemove, single = false, hideChips = false, pickAttr = 'data-pick', chipsAttr = 'data-chosen', resultsAttr = 'data-results', placeholder,
}: {
  id: string;
  label: string;
  structureId: string;
  selected: PickedStudent[];
  onAdd: (s: PickedStudent) => void;
  onRemove?: (s: PickedStudent) => void;
  single?: boolean;
  hideChips?: boolean;
  pickAttr?: string;
  chipsAttr?: string;
  resultsAttr?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(h);
  }, [text]);
  const query = useQuery({ queryKey: ['search-students', structureId, term], queryFn: () => api.searchStudents(structureId, term), enabled: !!structureId && term.length >= 2 });
  const results = text.trim().length >= 2 ? (query.data ?? []).filter((s) => !selected.some((x) => x.id === s.id)).slice(0, 10) : [];
  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} className="form-control" value={text} placeholder={placeholder} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      {query.isError && <div className="text-danger" role="alert">Recherche indisponible.</div>}
      {results.length > 0 && (
        <ul className="list-unstyled border mb-0" {...{ [resultsAttr]: '' }}>
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="btn btn-link"
                {...{ [pickAttr]: s.id }}
                onClick={() => { onAdd({ id: s.id, name: s.displayName, classe: s.classe }); setText(''); setTerm(''); }}
              >
                {s.displayName}{s.classe ? ` (${s.classe})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hideChips && (
        <div className="d-flex gap-8 flex-wrap mt-8" {...{ [chipsAttr]: '' }}>
          {selected.map((s) => (
            <span key={s.id} className="badge bg-secondary">
              {s.name}
              {onRemove && !single && <>{' '}<button type="button" className="btn btn-link p-0" aria-label={`Retirer ${s.name}`} onClick={() => onRemove(s)}>×</button></>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentSearch;
