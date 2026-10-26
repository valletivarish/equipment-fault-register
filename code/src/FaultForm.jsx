import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, STATUSES } from './api.js'

// en-CA formats as YYYY-MM-DD in the viewer's local time, which is what a date input expects.
const today = () => new Date().toLocaleDateString('en-CA')
const empty = () => ({
  asset_tag: '',
  equipment_name: '',
  fault_description: '',
  reported_date: today(),
  repair_status: 'Reported',
})

// One form for both "Report fault" (no id in the URL) and "Edit fault".
// The browser checks the obvious limits first (required, max length, date not
// in the future); the API repeats every check, and its messages are shown next
// to the matching field when the server rejects a value.
export default function FaultForm({ onSaved }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [values, setValues] = useState(empty)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)

  // App remounts this form whenever the URL id changes, so a new report always
  // starts empty and only the edit case needs to load the stored record.
  useEffect(() => {
    if (!editing) return
    api.get(id)
      .then((fault) => {
        const { asset_tag, equipment_name, fault_description, reported_date, repair_status } = fault
        setValues({ asset_tag, equipment_name, fault_description, reported_date, repair_status })
      })
      .catch((e) => setFormError(e.message))
      .finally(() => setLoading(false))
  }, [id, editing])

  function change(event) {
    const { name, value } = event.target
    setValues((old) => ({ ...old, [name]: value }))
    setFieldErrors((old) => ({ ...old, [name]: undefined }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const saved = editing ? await api.update(id, values) : await api.create(values)
      await onSaved()
      navigate(`/faults/${saved.id}`)
    } catch (e) {
      // Typed values are kept so nothing is lost when the save fails.
      setFieldErrors(e.fields || {})
      setFormError(e.message)
      setSaving(false)
    }
  }

  if (loading) return <p className="notice">Loading fault…</p>

  const cancelTo = editing ? `/faults/${id}` : '/'

  return (
    <form className="fault-form" onSubmit={submit}>
      <Link to={cancelTo} className={editing ? 'back' : 'back narrow-only'}>{editing ? 'Back to fault' : 'Back to register'}</Link>
      <h2>{editing ? 'Edit fault' : 'Report fault'}</h2>

      {formError && <p className="notice error" role="alert">{formError}</p>}

      <Field label="Asset tag" name="asset_tag" error={fieldErrors.asset_tag}
        hint="Letters, numbers and dashes, as printed on the sticker">
        <input id="asset_tag" name="asset_tag" value={values.asset_tag} onChange={change}
          required minLength={2} maxLength={20} pattern="[A-Za-z0-9\-]+" autoComplete="off" />
      </Field>

      <Field label="Equipment" name="equipment_name" error={fieldErrors.equipment_name}>
        <input id="equipment_name" name="equipment_name" value={values.equipment_name}
          onChange={change} required minLength={2} maxLength={80} />
      </Field>

      <Field label="What is wrong" name="fault_description" error={fieldErrors.fault_description}>
        <textarea id="fault_description" name="fault_description" rows={5}
          value={values.fault_description} onChange={change}
          required minLength={5} maxLength={1000} />
      </Field>

      <div className="field-row">
        <Field label="Reported on" name="reported_date" error={fieldErrors.reported_date}>
          <input id="reported_date" name="reported_date" type="date" value={values.reported_date}
            onChange={change} required max={today()} />
        </Field>

        <Field label="Status" name="repair_status" error={fieldErrors.repair_status}>
          <select id="repair_status" name="repair_status" value={values.repair_status}
            onChange={change}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="actions">
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Report fault'}
        </button>
        <Link to={cancelTo} className="button">Cancel</Link>
      </div>
    </form>
  )
}

function Field({ label, name, hint, error, children }) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="field-error" id={`${name}-error`}>{error}</small>}
    </div>
  )
}
