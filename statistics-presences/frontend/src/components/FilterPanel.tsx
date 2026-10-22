import { absenceSelected, EventType, Filters, PunishmentType, Reason, toggleReason, toggleType } from '../indicators';
import { statLabel } from '../utils';

/**
 * Paramètres d'un indicateur : types d'événement, motifs d'absence et de retard, types de punition et de sanction,
 * seuils (à partir de / jusqu'à n événements) et détail par créneau horaire.
 */
export function FilterPanel({
  filters, onChange, allowedTypes, reasons, punishmentTypes, showThresholds, showHourDetail, onApply, onCancel,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  allowedTypes: EventType[];
  reasons: Reason[];
  punishmentTypes: PunishmentType[];
  showThresholds: boolean;
  showHourDetail: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const absence = reasons.filter((r) => r.reason_type_id === 1).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const lateness = reasons.filter((r) => r.reason_type_id === 2 || r.id === 0);
  const showPunishments = filters.types.includes('PUNISHMENT') || filters.types.includes('SANCTION');
  const chip = (r: Reason) => (
    <button
      key={r.id}
      type="button"
      className={`btn btn-sm ${filters.reasons[r.id] ? 'btn-primary' : 'btn-outline-secondary'}`}
      data-reason={r.id}
      aria-pressed={Boolean(filters.reasons[r.id])}
      onClick={() => onChange(toggleReason(filters, r))}
    >
      {r.label}
    </button>
  );
  return (
    <section className="border rounded p-16 mb-16" data-filter-panel aria-label="Paramètres de l'indicateur">
      <h2 style={{ fontSize: 18 }} className="mb-12">Paramètres</h2>
      <fieldset className="mb-12" data-types>
        <legend className="form-label">Types d'événement</legend>
        {allowedTypes.map((t) => (
          <label key={t} className="me-12">
            <input type="checkbox" data-type={t} checked={filters.types.includes(t)} onChange={() => onChange(toggleType(filters, t, reasons, punishmentTypes))} /> {statLabel(t)}
          </label>
        ))}
      </fieldset>
      {absenceSelected(allowedTypes) && absence.length > 0 && (
        <div className="mb-12">
          <div className="form-label">Motifs d'absence</div>
          <div className="d-flex gap-8 flex-wrap" data-absence-reasons>{absence.map(chip)}</div>
        </div>
      )}
      {allowedTypes.includes('LATENESS') && lateness.length > 0 && (
        <div className="mb-12">
          <div className="form-label">Motifs de retard</div>
          <div className="d-flex gap-8 flex-wrap" data-lateness-reasons>{lateness.map(chip)}</div>
        </div>
      )}
      {showPunishments && punishmentTypes.length > 0 && (
        <div className="mb-12">
          <div className="form-label">Types de punition et de sanction</div>
          <div className="d-flex gap-8 flex-wrap" data-punishment-types>
            {[...punishmentTypes].sort((a, b) => a.label.localeCompare(b.label, 'fr')).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn btn-sm ${filters.punishmentTypes[t.id] ? 'btn-primary' : 'btn-outline-secondary'}`}
                data-punishment-type={t.id}
                aria-pressed={Boolean(filters.punishmentTypes[t.id])}
                onClick={() => onChange({ ...filters, punishmentTypes: { ...filters.punishmentTypes, [t.id]: !filters.punishmentTypes[t.id] } })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {showThresholds && (
        <div className="d-flex gap-24 flex-wrap mb-12">
          <label>
            <input type="checkbox" data-from-on checked={filters.from.on} onChange={(e) => onChange({ ...filters, from: { ...filters.from, on: e.target.checked } })} /> Afficher à partir de{' '}
            <input type="number" min={0} aria-label="Nombre minimal d'événements" data-from-value disabled={!filters.from.on} value={filters.from.value} onChange={(e) => onChange({ ...filters, from: { ...filters.from, value: Number(e.target.value) } })} /> événements
          </label>
          <label>
            <input type="checkbox" data-to-on checked={filters.to.on} onChange={(e) => onChange({ ...filters, to: { ...filters.to, on: e.target.checked } })} /> Afficher jusqu'à{' '}
            <input type="number" min={0} aria-label="Nombre maximal d'événements" data-to-value disabled={!filters.to.on} value={filters.to.value} onChange={(e) => onChange({ ...filters, to: { ...filters.to, value: Number(e.target.value) } })} /> événements
          </label>
        </div>
      )}
      {showHourDetail && (
        <label className="d-block mb-12">
          <input type="checkbox" data-hour-detail checked={filters.hourDetail} onChange={(e) => onChange({ ...filters, hourDetail: e.target.checked })} /> Afficher le détail par créneau horaire
        </label>
      )}
      <div className="d-flex gap-12">
        <button type="button" className="btn btn-primary" data-apply onClick={onApply}>Valider</button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Annuler</button>
      </div>
    </section>
  );
}

export default FilterPanel;
