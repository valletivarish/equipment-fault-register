import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'

// Browser tests for the whole application: React UI -> Nginx -> FastAPI -> PostgreSQL.
// Every record created here uses an "E2E-" asset tag, and cleanup only deletes
// those, so the @smoke tests are safe to run against the deployed register.

const TAG = `E2E-${Date.now().toString(36).toUpperCase()}`
const FAULT = {
  tag: TAG,
  name: 'Bench grinder',
  description: 'Guard rattles and the left wheel vibrates under load',
  date: '2026-10-21',
}

async function removeTestRecords(request) {
  const faults = await (await request.get('/api/faults')).json()
  for (const fault of faults.filter((f) => f.asset_tag.startsWith('E2E-'))) {
    await request.delete(`/api/faults/${fault.id}`)
  }
}

// Fails a test if the page logs a JavaScript error or an /api/ request breaks
// unexpectedly, so a success message without a working backend cannot pass.
function watchForProblems(page) {
  const problems = []
  page.on('console', (msg) => msg.type() === 'error' && problems.push(`console: ${msg.text()}`))
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`))
  page.on('requestfailed', (req) => problems.push(`failed request: ${req.url()}`))
  return problems
}

// Restarting the backend proves data lives in PostgreSQL, not in the API
// process. Only the local/CI stack sets this command; it is never run on AWS.
async function restartBackend(request) {
  execSync(process.env.RESTART_API_CMD, { stdio: 'inherit' })
  await expect
    .poll(async () => (await request.get('/api/health').catch(() => null))?.status(), {
      timeout: 30_000,
    })
    .toBe(200)
}

test.beforeAll(async ({ request }) => removeTestRecords(request))
test.afterAll(async ({ request }) => removeTestRecords(request))

test('report, read, edit and delete a fault through the UI @smoke', async ({ page, request }) => {
  const problems = watchForProblems(page)
  const apiCalls = []
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/')) {
      apiCalls.push(`${req.method()} ${new URL(req.url()).pathname.replace(/\d+$/, ':id')}`)
    }
  })

  await test.step('open the register and the report form', async () => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Fault register' })).toBeVisible()
    await page.getByRole('link', { name: 'Report fault' }).click()
    await expect(page).toHaveURL(/\/faults\/new$/)
    await expect(page.getByRole('heading', { name: 'Report fault' })).toBeVisible()
  })

  await test.step('create', async () => {
    await page.getByLabel('Asset tag').fill(FAULT.tag.toLowerCase())
    await page.getByLabel('Equipment').fill(FAULT.name)
    await page.getByLabel('What is wrong').fill(FAULT.description)
    await page.getByLabel('Reported on').fill(FAULT.date)
    await page.getByRole('button', { name: 'Report fault' }).click()

    await expect(page).toHaveURL(/\/faults\/\d+$/)
    const panel = page.locator('.panel')
    await expect(panel.getByRole('heading', { name: FAULT.name })).toBeVisible()
    await expect(panel.getByText(FAULT.tag, { exact: true })).toBeVisible() // stored in capitals
    await expect(panel.getByText(FAULT.description)).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(FAULT.tag) })).toContainText('Reported')
  })

  await test.step('read back after a browser reload', async () => {
    await page.reload()
    await expect(page.locator('.panel').getByRole('heading', { name: FAULT.name })).toBeVisible()
    await expect(page.locator('.panel')).toContainText('21 Oct 2026')
  })

  if (process.env.RESTART_API_CMD) {
    await test.step('read back after restarting the backend', async () => {
      await restartBackend(request)
      await page.reload()
      await expect(page.locator('.panel').getByText(FAULT.description)).toBeVisible()
    })
  }

  await test.step('update', async () => {
    await page.getByRole('link', { name: 'Edit fault' }).click()
    await expect(page.getByLabel('Equipment')).toHaveValue(FAULT.name)
    await page.getByLabel('Status').selectOption('Awaiting parts')
    await page.getByLabel('What is wrong').fill('Replacement guard ordered')
    await page.getByRole('button', { name: 'Save changes' }).click()
    // Wait until the app is back on the detail view, i.e. the save has finished.
    await expect(page).toHaveURL(/\/faults\/\d+$/)

    await page.reload()
    const panel = page.locator('.panel')
    await expect(panel).toContainText('Awaiting parts')
    await expect(panel).toContainText('Replacement guard ordered')
    await expect(panel.getByRole('heading', { name: FAULT.name })).toBeVisible() // unchanged field kept
    await expect(panel.getByText(FAULT.tag, { exact: true })).toBeVisible()
  })

  await test.step('cancelling delete keeps the fault', async () => {
    await page.getByRole('button', { name: 'Delete fault' }).click()
    await expect(page.getByText('Delete this fault?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep' }).click()
    await page.reload()
    await expect(page.locator('.panel').getByRole('heading', { name: FAULT.name })).toBeVisible()
  })

  await test.step('delete', async () => {
    await page.getByRole('button', { name: 'Delete fault' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('row', { name: new RegExp(FAULT.tag) })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('row', { name: new RegExp(FAULT.tag) })).toHaveCount(0)
  })

  expect(apiCalls).toEqual(expect.arrayContaining([
    'GET /api/faults', 'POST /api/faults', 'GET /api/faults/:id',
    'PUT /api/faults/:id', 'DELETE /api/faults/:id',
  ]))
  expect(problems).toEqual([])
})

test('invalid input is rejected and nothing is saved', async ({ page, request }) => {
  const countTestRecords = async () =>
    (await (await request.get('/api/faults')).json()).filter((f) => f.asset_tag.startsWith('E2E-')).length
  const before = await countTestRecords()

  await page.goto('/faults/new')
  const submit = page.getByRole('button', { name: 'Report fault' })

  // Empty required fields: the browser blocks the submit and flags the field.
  await submit.click()
  await expect(page).toHaveURL(/\/faults\/new$/)
  await expect(page.getByLabel('Asset tag')).toHaveJSProperty('validity.valueMissing', true)

  // Malformed tag and a future date are caught by the input constraints.
  await page.getByLabel('Asset tag').fill('WS 04!')
  await expect(page.getByLabel('Asset tag')).toHaveJSProperty('validity.patternMismatch', true)
  await page.getByLabel('Reported on').fill('2099-01-01')
  await expect(page.getByLabel('Reported on')).toHaveJSProperty('validity.rangeOverflow', true)

  // Spaces pass the browser's length check but the API trims and rejects them,
  // and its message appears next to the field while typed values are kept.
  await page.getByLabel('Asset tag').fill(`${TAG}-X`)
  await page.getByLabel('Equipment').fill('   ')
  await page.getByLabel('What is wrong').fill('Motor hums but does not start')
  await page.getByLabel('Reported on').fill('2026-10-20')
  await submit.click()
  await expect(page.getByRole('alert')).toHaveText('Some fields need fixing.')
  await expect(page.locator('#equipment_name-error')).toContainText('at least 2 characters')
  await expect(page.getByLabel('What is wrong')).toHaveValue('Motor hums but does not start')

  expect(await countTestRecords()).toBe(before)
})

test('a missing fault shows a clear message @smoke', async ({ page }) => {
  await page.goto('/faults/999999')
  await expect(page.getByRole('alert')).toHaveText('Fault not found')
  // On a laptop the register stays beside the panel, so the user can carry on.
  await expect(page.getByRole('region', { name: 'Fault register' })).toBeVisible()
  await page.getByRole('link', { name: 'Fault register' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('loading and backend failure states are usable', async ({ page }) => {
  // Hold the first request to show the loading text, then fail it as if the
  // backend were down. This only affects this browser tab, not the server.
  let release
  const held = new Promise((resolve) => { release = resolve })
  await page.route('**/api/faults', async (route) => {
    await held
    await route.abort('connectionrefused')
  })

  await page.goto('/')
  await expect(page.getByText('Loading the register…')).toBeVisible()
  release()
  await expect(page.getByRole('alert')).toContainText('The server could not be reached')

  // Once the backend is reachable again, "Try again" recovers without a reload.
  await page.unroute('**/api/faults')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Report fault' })).toBeVisible()
})

test('register works by keyboard and on a phone-sized screen', async ({ page, request }) => {
  await request.post('/api/faults', {
    data: {
      asset_tag: `${TAG}-M`, equipment_name: 'Scroll saw',
      fault_description: 'Blade tension knob is stripped', reported_date: '2026-10-19',
    },
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const row = page.getByRole('row', { name: new RegExp(`${TAG}-M`) })
  await expect(row).toBeVisible()

  // Keyboard: focus the row and press Enter to open it.
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/faults\/\d+$/)

  // On a narrow screen the panel replaces the register while a fault is open.
  await expect(page.getByRole('heading', { name: 'Scroll saw' })).toBeVisible()
  await expect(page.locator('.register')).toBeHidden()
  await page.getByRole('link', { name: 'Back to register' }).click()
  await expect(page.locator('.register')).toBeVisible()
})
