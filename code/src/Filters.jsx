import { STATUSES } from './api.js'

export default function Filters({ filters, onChange }) {
  const set = (changes) => onChange({ ...filters, ...changes })

  return (
    <div className="filters">
      <label className="search">
        <span className="visually-hidden">Search by tag or equipment</span>
        <input
          type="search"
          placeholder="Search tag or equipment"
          maxLength={40}
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
        />
      </label>
      <div className="chips" role="group" aria-label="Filter by status">
        {['', ...STATUSES].map((status) => (
          <button
            key={status || 'all'}
            type="button"
            className="chip"
            aria-pressed={filters.status === status}
            onClick={() => set({ status })}
          >
            {status || 'All'}
          </button>
        ))}
      </div>
    </div>
  )
}
