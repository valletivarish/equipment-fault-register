// Relative /api paths: the same build works behind Nginx on EC2 and the Vite proxy.

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('The server could not be reached. Check your connection and try again.')
  }

  if (response.status === 204) return null
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(body?.detail && typeof body.detail === 'string'
      ? body.detail
      : `Request failed (${response.status}).`)
    // FastAPI validation errors arrive as a list; map them to form fields.
    if (Array.isArray(body?.detail)) {
      error.fields = {}
      for (const item of body.detail) {
        const field = item.loc?.[item.loc.length - 1]
        if (field) error.fields[field] = friendlyMessage(item.msg)
      }
      error.message = 'Some fields need fixing.'
    }
    throw error
  }
  return body
}

// Pydantic's pattern message shows a regex, which means nothing to a user.
function friendlyMessage(message) {
  if (message.includes('should match pattern')) return 'Use only letters, numbers and dashes.'
  return message.replace(/^Value error, /, '')
}

export const api = {
  list: () => request('/faults'),
  get: (id) => request(`/faults/${id}`),
  create: (data) => request('/faults', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/faults/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/faults/${id}`, { method: 'DELETE' }),
}

export const STATUSES = ['Reported', 'In repair', 'Awaiting parts', 'Repaired', 'Written off']
