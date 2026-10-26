import { useEffect, useState } from 'react'
import { api } from './api.js'
import { formatDate } from './StatusMark.jsx'

const today = () => new Date().toLocaleDateString('en-CA')

// Dated notes on the work done for one fault, newest first.
export default function RepairLog({ fault }) {
  const [notes, setNotes] = useState(null)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = () => api.notes(fault.id).then(setNotes, (e) => setError(e.message))

  useEffect(() => {
    let current = true
    api.notes(fault.id)
      .then((data) => current && setNotes(data))
      .catch((e) => current && setError(e.message))
    return () => { current = false }
  }, [fault.id])

  async function remove(id) {
    try {
      await api.removeNote(id)
      setDeletingId(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section className="repair-log" aria-labelledby="repair-log-heading">
      <h3 id="repair-log-heading">Repair log</h3>

      <NoteForm
        minDate={fault.reported_date}
        submitLabel="Add note"
        onSave={async (data) => { await api.addNote(fault.id, data); await load() }}
      />

      {error && <p className="notice error" role="alert">{error}</p>}
      {notes === null && !error && <p className="notice">Loading notes…</p>}
      {notes?.length === 0 && <p className="notice">No repair work logged yet.</p>}

      <ol className="notes">
        {notes?.map((note) => (
          <li key={note.id}>
            {editingId === note.id ? (
              <NoteForm
                initial={note}
                minDate={fault.reported_date}
                submitLabel="Save note"
                onCancel={() => setEditingId(null)}
                onSave={async (data) => {
                  await api.updateNote(note.id, data)
                  setEditingId(null)
                  await load()
                }}
              />
            ) : (
              <>
                <p className="note-date">{formatDate(note.note_date)}</p>
                <p className="note-text">{note.note}</p>
                {deletingId === note.id ? (
                  <div className="note-actions" role="group" aria-label="Confirm note delete">
                    <span>Delete this note?</span>
                    <button type="button" className="link danger" onClick={() => remove(note.id)}>
                      Delete note
                    </button>
                    <button type="button" className="link" onClick={() => setDeletingId(null)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="note-actions">
                    <button type="button" className="link" onClick={() => setEditingId(note.id)}>
                      Edit
                    </button>
                    <button type="button" className="link" onClick={() => setDeletingId(note.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function NoteForm({ initial, minDate, submitLabel, onSave, onCancel }) {
  const [noteDate, setNoteDate] = useState(initial?.note_date ?? today())
  const [text, setText] = useState(initial?.note ?? '')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({ note_date: noteDate, note: text })
      if (!initial) setText('')
      setFieldErrors({})
    } catch (e) {
      setFieldErrors(e.fields || { note: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="note-form" onSubmit={submit} aria-label={submitLabel}>
      <div className="note-form-row">
        <label>
          <span>Date</span>
          <input type="date" value={noteDate} min={minDate} max={today()} required
            onChange={(e) => setNoteDate(e.target.value)} />
        </label>
        <label className="grow">
          <span>Work done</span>
          <input value={text} required minLength={3} maxLength={500}
            onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      {fieldErrors.note_date && <small className="field-error">{fieldErrors.note_date}</small>}
      {fieldErrors.note && <small className="field-error">{fieldErrors.note}</small>}
      <div className="note-form-actions">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && <button type="button" className="link" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
