import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { Person } from '../api';

/**
 * Recherche avec puces : on tape au moins deux lettres, on choisit dans la liste, la sélection s'affiche en puces.
 * `search` fournit les résultats ; la sélection est tenue par le parent (une seule à la fois en vue hebdomadaire).
 */
export function PersonSearch({
  id, label, placeholder, kind, search, selected, onAdd, onRemove,
}: {
  id: string;
  label: string;
  placeholder?: string;
  kind: string;
  search: (q: string) => Promise<Person[]>;
  selected: Person[];
  onAdd: (p: Person) => void;
  onRemove: (p: Person) => void;
}) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const query = useQuery({ queryKey: ['stats', 'search', kind, term], queryFn: () => search(term), enabled: term.length >= 2 });
  const results = (query.data ?? []).filter((p) => !selected.some((s) => s.id === p.id)).slice(0, 10);
  return (
    <div data-search={kind}>
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} className="form-control" value={q} placeholder={placeholder} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      {query.isError && <div className="text-danger" role="alert">Recherche indisponible.</div>}
      {results.length > 0 && (
        <ul className="list-unstyled border mb-0" data-results>
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="btn btn-link" data-pick={p.id} onClick={() => { onAdd(p); setQ(''); }}>{p.name}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="d-flex gap-8 flex-wrap mt-8" data-chosen={kind}>
        {selected.map((p) => (
          <span key={p.id} className="badge bg-secondary">
            {p.name}{' '}
            <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${p.name}`} onClick={() => onRemove(p)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default PersonSearch;
