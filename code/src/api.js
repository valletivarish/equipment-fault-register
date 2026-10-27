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

// Pydantic's messages are written for developers; these say the same in plain words.
function friendlyMessage(message) {
  if (message.includes('should match pattern')) return 'Use only letters, numbers and dashes.'
  const atLeast = message.match(/at least (\d+) character/)
  if (atLeast) return `Enter at least ${atLeast[1]} characters.`
  const atMost = message.match(/at most (\d+) character/)
  if (atMost) return `Use at most ${atMost[1]} characters.`
  if (message.includes('valid date')) return 'Enter a valid date.'
  if (message.startsWith('Input should be')) return 'Choose one of the listed options.'
  if (message === 'Field required') return 'This field is required.'
  return message.replace(/^Value error, /, '')
}

export const api = {
  list: ({ q = '', status = '', sort, order, page = 1 } = {}) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (q.trim()) params.set('q', q.trim())
    if (status) params.set('status', status)
    if (sort) params.set('sort', sort)
    if (order) params.set('order', order)
    return request(`/faults?${params}`)
  },
  get: (id) => request(`/faults/${id}`),
  create: (data) => request('/faults', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/faults/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/faults/${id}`, { method: 'DELETE' }),
  notes: (faultId) => request(`/faults/${faultId}/notes`),
  addNote: (faultId, data) =>
    request(`/faults/${faultId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
}

export const PAGE_SIZE = 10

export const PRIORITIES = ['Low', 'Medium', 'High']

export const STATUSES = ['Open', 'In progress', 'Waiting for parts', 'Fixed', 'Not repairable']
