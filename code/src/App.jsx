import { useCallback, useEffect, useState } from 'react'
import { Link, Route, Routes, useMatch, useParams } from 'react-router-dom'
import { api } from './api.js'
import FaultTable from './FaultTable.jsx'
import { FaultDetail, PanelPrompt } from './FaultDetail.jsx'
import FaultForm from './FaultForm.jsx'

// App owns the list of faults. The register on the left and the panel on the
// right both read from it, and every save or delete reloads it from the API
// so the screen always shows what is stored in the database.
export default function App() {
  const [faults, setFaults] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Reloads after a save or delete, called from event handlers.
  const reload = useCallback(async () => {
    try {
      setFaults(await api.list())
      setLoadError('')
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // First load when the page opens; state is only set once the request settles.
  useEffect(() => {
    api.list()
      .then(setFaults, (error) => setLoadError(error.message))
      .finally(() => setLoading(false))
  }, [])

  // On narrow screens the panel replaces the register whenever a fault or a
  // form is open; this flag lets CSS hide the register in that case.
  const panelOpen = Boolean(useMatch('/faults/*'))
  const selected = useMatch('/faults/:id/*')?.params.id
  const openCount = faults.filter((f) => !['Repaired', 'Written off'].includes(f.repair_status)).length

  return (
    <div className={panelOpen ? 'shell panel-open' : 'shell'}>
      <header className="topbar">
        <Link to="/" className="brand">Fault register</Link>
        {!loading && !loadError && (
          <p className="counts">
            {openCount} open of {faults.length} recorded
          </p>
        )}
        <Link to="/faults/new" className="button primary">Report fault</Link>
      </header>

      <main className="workbench">
        <section className="register" aria-label="Fault register">
          <FaultTable
            faults={faults}
            loading={loading}
            error={loadError}
            selectedId={selected}
            onRetry={reload}
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

// Gives the panel a new React key for every fault id, so moving from one fault
// to another (or to "Report fault") starts with clean state instead of
// showing the previous record while the next one loads.
function FreshPer({ Component, ...props }) {
  const { id } = useParams()
  return <Component key={id ?? 'new'} {...props} />
}
