import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { addAudiences, audienceSelection } from '../alerts';
import { api } from '../api';

export interface PickedAudience { id: string; name: string }

/**
 * Recherche de classes, groupes et regroupements (comme l'AngularJS) : un regroupement choisi est remplacé par les
 * classes qui le composent. La sélection s'affiche en puces.
 */
export function AudienceSearch({
  id, label, structureId, selected, onChange, pickAttr = 'data-pick-class', chipsAttr = 'data-chosen-classes', resultsAttr = 'data-class-results',
}: {
  id: string;
  label: string;
  structureId: string;
  selected: PickedAudience[];
  onChange: (next: PickedAudience[]) => void;
  pickAttr?: string;
  chipsAttr?: string;
  resultsAttr?: string;
}) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(h);
  }, [text]);
  const query = useQuery({ queryKey: ['search-audiences', structureId, term], queryFn: () => api.searchAudiences(structureId, term), enabled: !!structureId && term.length >= 1 });
  const results = text.trim().length >= 1 ? (query.data ?? []).filter((c) => !!c.members || !selected.some((x) => x.id === c.id)).slice(0, 10) : [];
  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} className="form-control" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      {query.isError && <div className="text-danger" role="alert">Recherche indisponible.</div>}
      {results.length > 0 && (
        <ul className="list-unstyled border mb-0" {...{ [resultsAttr]: '' }}>
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" className="btn btn-link" {...{ [pickAttr]: c.id }} onClick={() => { onChange(addAudiences(selected, audienceSelection(c))); setText(''); setTerm(''); }}>
                {c.name}{c.members ? ' (regroupement)' : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="d-flex gap-8 flex-wrap mt-8" {...{ [chipsAttr]: '' }}>
        {selected.map((c) => (
          <span key={c.id} className="badge bg-secondary">
            {c.name} <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${c.name}`} onClick={() => onChange(selected.filter((x) => x.id !== c.id))}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default AudienceSearch;
