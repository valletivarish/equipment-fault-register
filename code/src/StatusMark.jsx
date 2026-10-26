// Status is always written out in words; the small square only reinforces it,
// so the register still reads correctly for colour-blind users.
export default function StatusMark({ status }) {
  const key = status.toLowerCase().replace(/\s+/g, '-')
  return (
    <span className={`status status-${key}`}>
      <span className="status-mark" aria-hidden="true" />
      {status}
    </span>
  )
}

// Dates come from the API as YYYY-MM-DD. They are formatted as a plain
// calendar date (UTC) so the day never shifts with the viewer's timezone.
// eslint-disable-next-line react-refresh/only-export-components
export function formatDate(isoDate, short = false) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: short ? undefined : 'numeric',
    timeZone: 'UTC',
  })
}
