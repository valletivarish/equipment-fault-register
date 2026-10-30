import { useEffect, useState } from 'react'
import { Link, Route, Routes, useMatch, useParams } from 'react-router-dom'
import { api } from './api.js'
import FaultTable from './FaultTable.jsx'
import Filters from './Filters.jsx'
import { FaultDetail, PanelPrompt } from './FaultDetail.jsx'
import FaultForm from './FaultForm.jsx'

const DEFAULT_QUERY = { q: '', status: '', sort: 'reported_date', order: 'desc', page: 1 }
const EMPTY_PAGE = { items: [], total: 0, open_count: 0, urgent_count: 0, page: 1 }

export default function App() {
  const [result, setResult] = useState(EMPTY_PAGE)
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // A fresh query object re-runs the loading effect below with the same settings.
  const reload = () => setQuery((old) => ({ ...old }))

  // Typing waits 250 ms before searching so each keystroke is not a request;
  // a response for older filters is ignored if newer ones were chosen.
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      api.list(query)
        .then((data) => {
          if (!current) return
          // Deleting the last fault on a page leaves it empty: step back one page.
          if (data.items.length === 0 && data.page > 1) {
            setQuery((old) => ({ ...old, page: old.page - 1 }))
          } else {
            setResult(data)
            setLoadError('')
          }
        })
        .catch((error) => current && setLoadError(error.message))
        .finally(() => current && setLoading(false))
    }, query.q ? 250 : 0)
    return () => { current = false; clearTimeout(timer) }
  }, [query])

  // A new search, filter or sort starts again from the first page.
  const changeQuery = (changes) => setQuery((old) => ({ ...old, page: 1, ...changes }))

  // Lets CSS hide the register on phones while a fault or form is open.
  const panelOpen = Boolean(useMatch('/faults/*'))
  const selected = useMatch('/faults/:id/*')?.params.id
  const filtered = query.q !== '' || query.status !== ''

  return (
    <div className={panelOpen ? 'shell panel-open' : 'shell'}>
      <header className="topbar">
        <Link to="/" className="brand">Fault register</Link>
        {!loading && !loadError && (
          <p className="counts">
            {filtered
              ? `${result.total} matching ${result.total === 1 ? 'fault' : 'faults'}`
              : `${result.open_count} open of ${result.total} recorded · ${result.urgent_count} urgent`}
          </p>
        )}
        <Link to="/faults/new" className="button primary">Report fault</Link>
      </header>

      <main className="workbench">
        <section className="register" aria-label="Fault register">
          <Filters filters={query} onChange={changeQuery} />
          <FaultTable
            result={result}
            query={query}
            loading={loading}
            error={loadError}
            filtered={filtered}
            selectedId={selected}
            onRetry={reload}
            onSort={(sort) => changeQuery({
              sort, order: query.sort === sort && query.order === 'asc' ? 'desc' : 'asc',
            })}
            onPage={(page) => setQuery((old) => ({ ...old, page }))}
            onClearFilters={() => setQuery(DEFAULT_QUERY)}
          />
        </section>

        <aside className="panel">
          <Routes>
            <Route path="/" element={<PanelPrompt hasFaults={result.total > 0 || filtered} />} />
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
