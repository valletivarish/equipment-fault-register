import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from './api.js'
import RepairLog from './RepairLog.jsx'
import StatusMark, { daysLabel, formatDate } from './StatusMark.jsx'

export function PanelPrompt({ hasFaults }) {
  return (
    <div className="prompt">
      <h2>{hasFaults ? 'Select a fault' : 'Nothing to show yet'}</h2>
      <p>
        {hasFaults
          ? 'Pick a row in the register to see its details, or report a new fault.'
          : 'Report the first broken piece of equipment to start the register.'}
      </p>
    </div>
  )
}

// Fetched by id, not taken from the list, so a refreshed /faults/:id link works.
export function FaultDetail({ onDeleted }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [fault, setFault] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Ignore a late response after the user has moved to another fault.
  useEffect(() => {
    let current = true
    api.get(id)
      .then((data) => current && setFault(data))
      .catch((e) => current && setError(e.message))
    return () => { current = false }
  }, [id])

  async function handleDelete() {
    setBusy(true)
    try {
      await api.remove(id)
      await onDeleted()
      navigate('/')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="detail">
        <BackLink />
        <p className="notice error" role="alert">{error}</p>
      </div>
    )
  }
  if (!fault) return <p className="notice">Loading fault…</p>

  return (
    <article className="detail">
      <BackLink />
      <h2>{fault.equipment_name}</h2>
      <p className="tag">{fault.asset_tag}</p>

      <dl className="facts">
        <dt>Status</dt>
        <dd><StatusMark status={fault.repair_status} /></dd>
        <dt>Priority</dt>
        <dd className={`priority-${fault.priority.toLowerCase()}`}>{fault.priority}</dd>
        <dt>Location</dt>
        <dd>{fault.location}</dd>
        <dt>Reported</dt>
        <dd className="date">{formatDate(fault.reported_date)}</dd>
        <dt>Open for</dt>
        <dd>{daysLabel(fault.days_open)}</dd>
      </dl>

      <h3>Fault</h3>
      <p className="description">{fault.fault_description}</p>

      {confirming ? (
        <div className="confirm" role="group" aria-label="Confirm delete">
          <p>Delete this fault? This cannot be undone.</p>
          <button type="button" className="button danger" onClick={handleDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Yes, delete fault'}
          </button>
          <button type="button" className="button" onClick={() => setConfirming(false)}>Keep</button>
        </div>
      ) : (
        <div className="actions">
          <Link to={`/faults/${fault.id}/edit`} className="button primary">Edit fault</Link>
          <button type="button" className="button" onClick={() => setConfirming(true)}>
            Delete fault
          </button>
        </div>
      )}

      <RepairLog fault={fault} />
    </article>
  )
}

function BackLink() {
  return <Link to="/" className="back narrow-only">Back to register</Link>
}
