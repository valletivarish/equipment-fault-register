// The word is always shown, so status never depends on colour alone.
export default function StatusMark({ status }) {
  const key = status.toLowerCase().replace(/\s+/g, '-')
  return (
    <span className={`status status-${key}`}>
      <span className="status-mark" aria-hidden="true" />
      {status}
    </span>
  )
}

// Formatted in UTC so a YYYY-MM-DD date never shifts with the viewer's timezone.
// eslint-disable-next-line react-refresh/only-export-components
export function formatDate(isoDate, short = false) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: short ? undefined : 'numeric',
    timeZone: 'UTC',
  })
}
