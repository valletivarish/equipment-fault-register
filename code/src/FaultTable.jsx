import { useNavigate } from 'react-router-dom'
import StatusMark, { formatDate } from './StatusMark.jsx'

export default function FaultTable({
  faults, loading, error, filtered, selectedId, onRetry, onClearFilters,
}) {
  const navigate = useNavigate()

  if (loading) return <p className="notice">Loading the register…</p>

  if (error) {
    return (
      <div className="notice error" role="alert">
        <p>{error}</p>
        <button type="button" className="button" onClick={onRetry}>Try again</button>
      </div>
    )
  }

  if (faults.length === 0 && filtered) {
    return (
      <div className="notice">
        <p>No faults match these filters.</p>
        <button type="button" className="button" onClick={onClearFilters}>Clear filters</button>
      </div>
    )
  }

  if (faults.length === 0) {
    return <p className="notice">No faults recorded. Use “Report fault” when something breaks.</p>
  }

  return (
    <table className="faults">
      <thead>
        <tr>
          <th scope="col">Tag</th>
          <th scope="col">Equipment</th>
          <th scope="col">Location</th>
          <th scope="col">Reported</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {faults.map((fault) => {
          const isSelected = String(fault.id) === selectedId
          const open = () => navigate(`/faults/${fault.id}`)
          return (
            <tr
              key={fault.id}
              className={isSelected ? 'selected' : undefined}
              aria-selected={isSelected}
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
            >
              <td className="tag">{fault.asset_tag}</td>
              <td>{fault.equipment_name}</td>
              <td className="muted">{fault.location}</td>
              <td className="date">{formatDate(fault.reported_date, true)}</td>
              <td><StatusMark status={fault.repair_status} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
