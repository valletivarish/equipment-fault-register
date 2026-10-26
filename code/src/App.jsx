import { useCallback, useEffect, useState } from 'react'
import { Link, Route, Routes, useMatch, useParams } from 'react-router-dom'
import { api } from './api.js'
import FaultTable from './FaultTable.jsx'
import Filters from './Filters.jsx'
import { FaultDetail, PanelPrompt } from './FaultDetail.jsx'
import FaultForm from './FaultForm.jsx'

const NO_FILTERS = { q: '', status: '' }

export default function App() {
  const [faults, setFaults] = useState([])
  const [filters, setFilters] = useState(NO_FILTERS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const reload = useCallback(async () => {
    try {
      setFaults(await api.list(filters))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Typing waits 250 ms before searching so each keystroke is not a request;
  // a response for older filters is ignored if newer ones were chosen.
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      api.list(filters)
        .then((data) => { if (current) { setFaults(data); setLoadError('') } })
        .catch((error) => current && setLoadError(error.message))
        .finally(() => current && setLoading(false))
    }, filters.q ? 250 : 0)
    return () => { current = false; clearTimeout(timer) }
  }, [filters])

  // Lets CSS hide the register on phones while a fault or form is open.
  const panelOpen = Boolean(useMatch('/faults/*'))
  const selected = useMatch('/faults/:id/*')?.params.id
  const filtered = filters.q !== '' || filters.status !== ''
  const openCount = faults.filter((f) => !['Repaired', 'Written off'].includes(f.repair_status)).length

  return (
    <div className={panelOpen ? 'shell panel-open' : 'shell'}>
      <header className="topbar">
        <Link to="/" className="brand">Fault register</Link>
        {!loading && !loadError && (
          <p className="counts">
            {filtered
              ? `${faults.length} matching ${faults.length === 1 ? 'fault' : 'faults'}`
              : `${openCount} open of ${faults.length} recorded`}
          </p>
        )}
        <Link to="/faults/new" className="button primary">Report fault</Link>
      </header>

      <main className="workbench">
        <section className="register" aria-label="Fault register">
          <Filters filters={filters} onChange={setFilters} />
          <FaultTable
            faults={faults}
            loading={loading}
            error={loadError}
            filtered={filtered}
            selectedId={selected}
            onRetry={reload}
            onClearFilters={() => setFilters(NO_FILTERS)}
          />
        </section>

        <aside className="panel">
          <Routes>
            <Route path="/" element={<PanelPrompt hasFaults={faults.length > 0} />} />
            <Route path="/faults/new" element={<FreshPer Component={FaultForm} onSaved={reload} />} />
            <Route path="/faults/:id"
              element={<FreshPer Component={FaultDetail} onDeleted={reload} />} />
            <Route path="/faults/:id/edit"
              element={<FreshPer Component={FaultForm} onSaved={reload} />} />
            <Route path="*" element={<p className="notice">That page does not exist.</p>} />
          </Routes>
        </aside>
      </main>
    </div>
  )
}

// New key per fault id resets panel state instead of showing the previous record.
function FreshPer({ Component, ...props }) {
  const { id } = useParams()
  return <Component key={id ?? 'new'} {...props} />
}
