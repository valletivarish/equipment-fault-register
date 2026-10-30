import { useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from './api.js'
import StatusMark, { formatDate } from './StatusMark.jsx'

const COLUMNS = [
  ['asset_tag', 'Tag'],
  ['equipment_name', 'Equipment'],
  ['location', 'Location'],
  ['reported_date', 'Reported'],
  ['priority', 'Priority'],
  ['repair_status', 'Status'],
]

export default function FaultTable({
  result, query, loading, error, filtered, selectedId, onRetry, onSort, onPage, onClearFilters,
}) {
  const navigate = useNavigate()
  const faults = result.items

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

  const first = (result.page - 1) * PAGE_SIZE + 1
  const last = first + faults.length - 1
  const lastPage = Math.ceil(result.total / PAGE_SIZE)

  return (
    <>
      <table className="faults">
        <thead>
          <tr>
            {COLUMNS.map(([key, label]) => {
              const active = query.sort === key
              const direction = query.order === 'asc' ? 'ascending' : 'descending'
              return (
                <th key={key} scope="col" aria-sort={active ? direction : 'none'}>
                  <button type="button" className="sort" onClick={() => onSort(key)}>
                    {label}
                    <span className="sort-mark" aria-hidden="true">
                      {active ? (query.order === 'asc' ? '↑' : '↓') : ''}
                    </span>
                  </button>
                </th>
              )
            })}
            <th scope="col">Days open</th>
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
                <td className={`priority-${fault.priority.toLowerCase()}`}>{fault.priority}</td>
                <td><StatusMark status={fault.repair_status} /></td>
                <td className="days">{fault.days_open ?? '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <nav className="pager" aria-label="Register pages">
        <span>Showing {first}–{last} of {result.total}</span>
        <button type="button" className="button" disabled={result.page <= 1}
          onClick={() => onPage(result.page - 1)}>
          Previous
        </button>
        <span>Page {result.page} of {lastPage}</span>
        <button type="button" className="button" disabled={result.page >= lastPage}
          onClick={() => onPage(result.page + 1)}>
          Next
        </button>
      </nav>
    </>
  )
}
