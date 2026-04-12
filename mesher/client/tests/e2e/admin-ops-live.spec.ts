import { expect, test } from '@playwright/test'

const DEFAULT_API_KEY = 'mshr_devdefaultapikey000000000000000000000000000'
const DEFAULT_MESHER_BACKEND_ORIGIN = process.env.MESHER_BACKEND_ORIGIN ?? 'http://127.0.0.1:18180'
const DIRECT_BACKEND_PORT = new URL(DEFAULT_MESHER_BACKEND_ORIGIN).port || '80'
const DIRECT_BACKEND_HOST = new URL(DEFAULT_MESHER_BACKEND_ORIGIN).hostname
const SEEDED_OWNER_USER_ID = '11111111-1111-4111-8111-111111111111'
const SEEDED_ADMIN_USER_ID = '22222222-2222-4222-8222-222222222222'
const SEEDED_CANDIDATE_USER_ID = '33333333-3333-4333-8333-333333333333'
const SEEDED_CANDIDATE_EMAIL = 'seed-candidate@hyperpush.dev'

type RuntimeSignalTracker = {
  consoleErrors: string[]
  failedRequests: string[]
  sameOriginApiPaths: string[]
  sameOriginApiCalls: string[]
  directBackendRequests: string[]
}

type SeededAlert = {
  alertId: string
  ruleId: string
  ruleName: string
}

function attachRuntimeSignalTracking(page: import('@playwright/test').Page): RuntimeSignalTracker {
  const runtimeSignals: RuntimeSignalTracker = {
    consoleErrors: [],
    failedRequests: [],
    sameOriginApiPaths: [],
    sameOriginApiCalls: [],
    directBackendRequests: [],
  }

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeSignals.consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    runtimeSignals.consoleErrors.push(error.message)
  })

  page.on('request', (request) => {
    const url = new URL(request.url())

    if (url.pathname === '/api/v1' || url.pathname.startsWith('/api/v1/')) {
      runtimeSignals.sameOriginApiPaths.push(url.pathname)
      runtimeSignals.sameOriginApiCalls.push(`${request.method()} ${url.pathname}`)
    }

    if (url.hostname === DIRECT_BACKEND_HOST && url.port === DIRECT_BACKEND_PORT) {
      runtimeSignals.directBackendRequests.push(request.url())
    }
  })

  page.on('requestfailed', (request) => {
    runtimeSignals.failedRequests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown error'}`,
    )
  })

  page.on('response', (response) => {
    if (response.status() >= 400) {
      runtimeSignals.failedRequests.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      )
    }
  })

  return runtimeSignals
}

function filteredConsoleErrors(runtimeSignals: RuntimeSignalTracker, allowedSubstrings: string[] = []) {
  return runtimeSignals.consoleErrors.filter(
    (entry) => !allowedSubstrings.some((allowed) => entry.includes(allowed)),
  )
}

function filteredFailedRequests(runtimeSignals: RuntimeSignalTracker) {
  return runtimeSignals.failedRequests.filter((entry) => {
    const isExpectedRefreshAbort =
      entry.includes(':: net::ERR_ABORTED') &&
      (
        entry.includes('/api/v1/projects/default/alerts') ||
        entry.includes('/api/v1/projects/default/issues') ||
        entry.includes('/api/v1/projects/default/dashboard/health') ||
        entry.includes('/api/v1/projects/default/dashboard/levels') ||
        entry.includes('/api/v1/projects/default/dashboard/volume') ||
        entry.includes('/api/v1/projects/default/settings') ||
        entry.includes('/api/v1/projects/default/storage') ||
        entry.includes('/api/v1/orgs/default/members') ||
        entry.includes('/api/v1/projects/default/api-keys') ||
        entry.includes('/api/v1/projects/default/alert-rules')
      )

    return !isExpectedRefreshAbort
  })
}

function uniqueSeedSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForAlertsOverviewReady(page: import('@playwright/test').Page) {
  const alertsShell = page.getByTestId('alerts-shell')
  await expect(alertsShell).toHaveAttribute('data-bootstrap-state', 'ready', { timeout: 20_000 })
  return alertsShell
}

async function createSeededLiveAlert(
  request: import('@playwright/test').APIRequestContext,
  suffix = uniqueSeedSuffix(),
): Promise<SeededAlert> {
  const ruleName = `M060 admin ops live alert ${suffix}`
  const createRuleResponse = await request.post('/api/v1/projects/default/alert-rules', {
    data: {
      name: ruleName,
      condition: {
        condition_type: 'new_issue',
      },
      action: {
        type: 'email',
      },
      cooldown_minutes: 1,
    },
  })

  expect(createRuleResponse.ok()).toBeTruthy()
  const createRulePayload = await createRuleResponse.json()
  expect(typeof createRulePayload.id).toBe('string')

  const eventFingerprint = `m060-admin-ops-live-alert-${suffix}`
  const ingestResponse = await request.post('/api/v1/events', {
    headers: {
      'content-type': 'application/json',
      'x-sentry-auth': DEFAULT_API_KEY,
    },
    data: {
      message: `Seeded alert event ${suffix}`,
      level: 'error',
      fingerprint: eventFingerprint,
      tags: JSON.stringify({
        environment: 'seeded-local',
        seed_case: 'm060-admin-ops-live-alerts',
      }),
      extra: JSON.stringify({
        surface: 'alerts-dashboard',
      }),
      sdk_name: 'playwright',
      sdk_version: '1.0.0',
    },
  })

  expect(ingestResponse.ok()).toBeTruthy()
  const ingestPayload = await ingestResponse.json()
  expect(['accepted', 'ok']).toContain(ingestPayload.status)

  let lastAlertSummary = '[]'
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const alertsResponse = await request.get('/api/v1/projects/default/alerts')
    expect(alertsResponse.ok()).toBeTruthy()
    const alertsPayload = await alertsResponse.json()
    lastAlertSummary = JSON.stringify(
      alertsPayload
        .slice(0, 5)
        .map((alert: { id?: string; rule_name?: string; status?: string }) => ({
          id: alert.id,
          rule_name: alert.rule_name,
          status: alert.status,
        })),
    )
    const seededAlert = alertsPayload.find(
      (alert: { id?: string; rule_name?: string; status?: string }) => alert.rule_name === ruleName,
    )

    if (seededAlert && typeof seededAlert.id === 'string' && seededAlert.status === 'active') {
      return {
        alertId: seededAlert.id,
        ruleId: createRulePayload.id as string,
        ruleName,
      }
    }

    await sleep(250)
  }

  throw new Error(
    `Expected seeded alert for rule ${ruleName} to appear in /api/v1/projects/default/alerts within 20s; last alerts snapshot: ${lastAlertSummary}`,
  )
}

test.describe('admin and ops live alerts', () => {
  test('admin and ops live alerts acknowledge and resolve a real Mesher alert through same-origin refreshes', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await createSeededLiveAlert(request)

    await page.goto('/alerts')

    const alertsShell = await waitForAlertsOverviewReady(page)
    const detailPanel = page.getByTestId('alert-detail-panel')
    const alertRow = page.getByTestId(`alert-row-${seeded.alertId}`)

    await expect(alertsShell).toHaveAttribute('data-overview-source', /(live|mixed)/)
    await expect(alertsShell).toHaveAttribute('data-live-alert-count', /\d+/)
    await expect(page.getByTestId('alerts-stats-bar')).toBeVisible()
    await expect(page.getByText('Live alerts active', { exact: false })).toBeVisible()
    await expect(alertRow).toBeVisible()
    await expect(page.getByTestId(`alert-row-source-${seeded.alertId}`)).toContainText('mixed live')

    await alertRow.click()

    await expect(detailPanel).toBeVisible()
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(detailPanel).toHaveAttribute('data-state', 'ready')
    await expect(alertsShell).toHaveAttribute('data-selected-alert-id', seeded.alertId)
    await expect(alertsShell).toHaveAttribute('data-selected-alert-source', 'mixed')
    await expect(page.getByTestId('alert-detail-live-banner')).toContainText('Live alerts active')
    await expect(page.getByTestId('alert-detail-source-badge')).toContainText('mixed live')
    await expect(page.getByTestId('alert-detail-action-source-note')).toContainText('/api/v1/alerts')
    await expect(page.getByTestId('alert-detail-action-acknowledge')).toContainText('Acknowledge')
    await expect(page.getByTestId('alert-detail-action-resolve')).toContainText('Resolve')
    await expect(page.getByTestId('alert-detail-action-silence')).toHaveAttribute('data-source', 'shell-only')
    await expect(page.getByTestId('alert-detail-action-silence')).toBeDisabled()
    await expect(page.getByTestId('alert-detail-copy-link')).toHaveAttribute('data-source', 'shell-only')

    await page.getByTestId('alert-detail-action-acknowledge').click()

    await expect.poll(async () => alertsShell.getAttribute('data-last-action')).toBe('acknowledge')
    await expect.poll(async () => alertsShell.getAttribute('data-alert-action-phase')).toBe('idle')
    await expect(alertsShell).toHaveAttribute('data-selected-alert-id', seeded.alertId)
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(page.getByTestId('alert-detail-status-label')).toContainText('acknowledged')

    await page.getByTestId('alerts-status-filter-acknowledged').click()
    await expect(alertRow).toBeVisible()
    await expect(alertRow).toContainText('acknowledged')

    await page.getByTestId('alert-detail-action-resolve').click()

    await expect.poll(async () => alertsShell.getAttribute('data-last-action')).toBe('resolve')
    await expect.poll(async () => alertsShell.getAttribute('data-alert-action-phase')).toBe('idle')
    await expect(alertsShell).toHaveAttribute('data-selected-alert-id', seeded.alertId)
    await expect(page.getByTestId('alert-detail-status-label')).toContainText('resolved')
    await expect(page.getByTestId('alert-detail-action-resolve')).toHaveCount(0)
    await expect(page.getByTestId('alert-detail-action-acknowledge')).toHaveCount(0)

    await page.getByTestId('alerts-status-filter-resolved').click()
    await expect(alertRow).toBeVisible()
    await expect(alertRow).toContainText('resolved')

    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes('/api/v1/projects/default/alerts'))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/alerts/${seeded.alertId}/acknowledge`))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/alerts/${seeded.alertId}/resolve`))
      .toBe(true)

    expect(
      runtimeSignals.directBackendRequests,
      'Expected browser traffic to stay on same-origin /api/v1 instead of calling Mesher directly',
    ).toEqual([])
    expect(filteredConsoleErrors(runtimeSignals), 'Expected live alert lifecycle path without console errors').toEqual([])
    expect(filteredFailedRequests(runtimeSignals), 'Expected live alert lifecycle path without unexpected failed requests').toEqual([])
  })

  test('admin and ops live alerts keep the shell mounted with explicit fallback state when bootstrap fails', async ({ page }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.route('**/api/v1/projects/default/alerts', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'alerts unavailable' }),
      })
    })

    await page.goto('/alerts')

    const alertsShell = page.getByTestId('alerts-shell')
    await expect(alertsShell).toHaveAttribute('data-bootstrap-state', 'failed')
    await expect(alertsShell).toHaveAttribute('data-overview-source', 'fallback')
    await expect(page.getByTestId('alerts-stats-bar')).toHaveAttribute('data-source', 'fallback')
    await expect(page.getByText('Fallback alerts active', { exact: false })).toBeVisible()
    await expect(
      page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Live alerts failed' }),
    ).toBeVisible()
    await expect
      .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes('/api/v1/projects/default/alerts')))
      .toBe(true)

    expect(
      filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
      'Expected alerts bootstrap failure path to avoid unexpected console errors',
    ).toEqual([])
  })

  test('admin and ops live alerts keep the selected alert visible and show a destructive toast when a mutation fails', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await createSeededLiveAlert(request)

    await page.route(`**/api/v1/alerts/${seeded.alertId}/acknowledge`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mutation failed' }),
      })
    })

    await page.goto('/alerts')
    await page.getByTestId(`alert-row-${seeded.alertId}`).click()
    await page.getByTestId('alert-detail-action-acknowledge').click()

    const alertsShell = page.getByTestId('alerts-shell')
    await expect(alertsShell).toHaveAttribute('data-last-action', 'acknowledge')
    await expect(alertsShell).toHaveAttribute('data-alert-action-phase', 'failed')
    await expect(alertsShell).toHaveAttribute('data-alert-action-error-code', 'http')
    await expect(alertsShell).toHaveAttribute('data-alert-action-error-stage', 'mutation')
    await expect(alertsShell).toHaveAttribute('data-selected-alert-id', seeded.alertId)
    await expect(page.getByTestId('alert-detail-panel')).toBeVisible()
    await expect(page.getByTestId('alert-detail-action-error')).toContainText('Last live action failed (http)')
    await expect(
      page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Acknowledge failed' }),
    ).toBeVisible()

    await expect
      .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes(`/api/v1/alerts/${seeded.alertId}/acknowledge`)))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/alerts/${seeded.alertId}/acknowledge`))
      .toBe(true)

    expect(
      filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
      'Expected alert mutation failure path to avoid unexpected console errors',
    ).toEqual([])
  })

  test('admin and ops live alerts treat malformed live payloads as contract failures instead of guessing shell status', async ({
    page,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.route('**/api/v1/projects/default/alerts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'malformed-live-alert',
            rule_id: 'rule-1',
            project_id: 'default',
            status: 'mystery',
            message: 'Malformed alert payload',
            condition_snapshot: 'not-an-object',
            triggered_at: 'not-a-timestamp',
            acknowledged_at: null,
            resolved_at: null,
            rule_name: 'Malformed live rule',
          },
        ]),
      })
    })

    await page.goto('/alerts')

    const alertsShell = page.getByTestId('alerts-shell')
    await expect(alertsShell).toHaveAttribute('data-bootstrap-state', 'failed')
    await expect(alertsShell).toHaveAttribute('data-bootstrap-error-code', 'invalid-payload')
    await expect(alertsShell).toHaveAttribute('data-overview-source', 'fallback')
    await expect(page.getByText('Fallback alerts active', { exact: false })).toBeVisible()
    await expect(
      page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Live alerts failed' }),
    ).toBeVisible()

    expect(filteredConsoleErrors(runtimeSignals), 'Expected malformed alerts payload path without console errors').toEqual([])
  })

  test('admin and ops live alerts keep an empty live list truthful without rehydrating fallback rows', async ({ page }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.route('**/api/v1/projects/default/alerts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/alerts')

    const alertsShell = await waitForAlertsOverviewReady(page)
    await expect(alertsShell).toHaveAttribute('data-live-alert-count', '0')
    await expect(alertsShell).toHaveAttribute('data-overview-source', 'mixed')
    await expect(page.getByTestId('alerts-empty-state')).toBeVisible()
    await expect(page.getByTestId('alerts-stat-card-total-alerts-source')).toHaveText('derived live')
    await expect(page.getByText('No alerts found')).toBeVisible()

    expect(filteredConsoleErrors(runtimeSignals), 'Expected empty live alerts path without console errors').toEqual([])
    expect(filteredFailedRequests(runtimeSignals), 'Expected empty live alerts path without failed requests').toEqual([])
  })
})

async function fetchProjectSettings(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get('/api/v1/projects/default/settings')
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as { retention_days: number; sample_rate: number }
}

async function listProjectApiKeys(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get('/api/v1/projects/default/api-keys')
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{ id: string; label: string; revoked_at: string | null }>
}

async function listProjectAlertRules(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get('/api/v1/projects/default/alert-rules')
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{ id: string; name: string }>
}

async function revokeKeyByLabel(
  request: import('@playwright/test').APIRequestContext,
  label: string,
) {
  const keys = await listProjectApiKeys(request)
  const key = keys.find((entry) => entry.label === label && entry.revoked_at === null)
  if (!key) {
    return
  }

  const revokeResponse = await request.post(`/api/v1/api-keys/${key.id}/revoke`)
  expect(revokeResponse.ok()).toBeTruthy()
}

async function deleteRuleByName(
  request: import('@playwright/test').APIRequestContext,
  name: string,
) {
  const rules = await listProjectAlertRules(request)
  const rule = rules.find((entry) => entry.name === name)
  if (!rule) {
    return
  }

  const deleteResponse = await request.post(`/api/v1/alert-rules/${rule.id}/delete`)
  expect(deleteResponse.ok()).toBeTruthy()
}

async function listOrgMembers(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get('/api/v1/orgs/default/members')
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{
    id: string
    user_id: string
    email: string
    display_name: string
    role: string
  }>
}

async function removeOrgMemberByUserId(
  request: import('@playwright/test').APIRequestContext,
  userId: string,
) {
  const members = await listOrgMembers(request)
  const member = members.find((entry) => entry.user_id === userId)
  if (!member) {
    return
  }

  const removeResponse = await request.post(`/api/v1/orgs/default/members/${member.id}/remove`)
  expect(removeResponse.ok()).toBeTruthy()
}

test.describe('admin and ops live settings', () => {
  test('admin and ops live settings wire same-origin general, team, api keys, and alert rules without fake global save drift', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const originalSettings = await fetchProjectSettings(request)
    const createdKeyLabel = `M060 live key ${uniqueSeedSuffix()}`
    const createdRuleName = `M060 live rule ${uniqueSeedSuffix()}`
    const nextRetention = originalSettings.retention_days === 90 ? 120 : 90
    const nextSampleRatePercent = originalSettings.sample_rate === 1 ? '50' : '100'

    try {
      await removeOrgMemberByUserId(request, SEEDED_CANDIDATE_USER_ID)
      await page.goto('/settings')

      const settingsShell = page.getByTestId('settings-shell')
      await expect(settingsShell).toHaveAttribute('data-current-tab', 'general')
      await expect(settingsShell).toHaveAttribute('data-general-state', 'ready')
      await expect(page.getByTestId('settings-shell-support-badge')).toContainText('mixed live')
      await expect(page.getByTestId('settings-general-panel')).toHaveAttribute('data-source', 'mixed')
      await expect(page.getByTestId('settings-general-source-badge')).toContainText('mixed')
      await expect(page.getByTestId('settings-general-status-banner')).toContainText('Live retention and storage active')
      await expect(page.getByTestId('settings-general-mock-only-banner')).toContainText('Mock-only shell')
      await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0)

      await page.getByTestId('settings-retention-days-input').fill(String(nextRetention))
      await page.getByTestId('settings-sample-rate-input').fill(nextSampleRatePercent)
      await page.getByTestId('settings-general-save').click()

      await expect(settingsShell).toHaveAttribute('data-last-mutation-section', 'general')
      await expect(settingsShell).toHaveAttribute('data-last-mutation-phase', 'idle')
      await expect(page.getByTestId('settings-retention-days-input')).toHaveValue(String(nextRetention))
      await expect(page.getByTestId('settings-sample-rate-input')).toHaveValue(nextSampleRatePercent)

      await page.getByRole('button', { name: /Team/ }).click()
      await expect(settingsShell).toHaveAttribute('data-current-tab', 'team')
      await expect(settingsShell).toHaveAttribute('data-team-state', 'ready')
      await expect(page.getByTestId('settings-shell-support-badge')).toContainText('live')
      await expect(page.getByTestId('settings-team-panel')).toHaveAttribute('data-state', 'ready')
      await expect(page.getByTestId('settings-team-status-banner')).toContainText('Live team membership active')
      await expect(page.getByTestId('settings-team-source-badge')).toContainText('live')
      await expect(page.getByText(SEEDED_CANDIDATE_EMAIL)).toHaveCount(0)

      await page.getByTestId('settings-team-open-create').click()
      await page.getByTestId('settings-team-user-id-input').fill(SEEDED_CANDIDATE_USER_ID)
      await page.getByTestId('settings-team-role-select').selectOption('member')
      await page.getByTestId('settings-team-submit').click()

      const createdMemberRow = page.locator('[data-testid^="settings-team-row-"]').filter({ hasText: SEEDED_CANDIDATE_EMAIL }).first()
      await expect(createdMemberRow).toBeVisible()
      const createdMemberRowTestId = await createdMemberRow.getAttribute('data-testid')
      expect(createdMemberRowTestId).toBeTruthy()
      const createdMembershipId = createdMemberRowTestId!.replace('settings-team-row-', '')

      await page.getByTestId(`settings-team-row-role-${createdMembershipId}`).selectOption('admin')
      await expect(createdMemberRow).toContainText('admin')

      await page.getByTestId(`settings-team-row-remove-${createdMembershipId}`).click()
      await expect(createdMemberRow).toHaveCount(0)

      await page.getByRole('button', { name: /API Keys/ }).click()
      await expect(settingsShell).toHaveAttribute('data-current-tab', 'api-keys')
      await expect(page.getByTestId('settings-api-keys-panel')).toHaveAttribute('data-state', 'ready')

      await page.getByTestId('settings-api-keys-open-create').click()
      await page.getByTestId('settings-api-key-label-input').fill(createdKeyLabel)
      await page.getByTestId('settings-api-key-submit').click()

      await expect(page.getByTestId('settings-api-key-reveal')).toBeVisible()
      const revealSecret = await page.getByTestId('settings-api-key-reveal-secret').textContent()
      expect((revealSecret ?? '').length).toBeGreaterThan(20)

      const createdKeyRow = page.locator('[data-testid^="settings-api-key-row-"]').filter({ hasText: createdKeyLabel }).first()
      await expect(createdKeyRow).toBeVisible()
      const createdKeyRowTestId = await createdKeyRow.getAttribute('data-testid')
      expect(createdKeyRowTestId).toBeTruthy()
      const createdKeyId = createdKeyRowTestId!.replace('settings-api-key-row-', '')

      await page.getByTestId('settings-api-key-reveal-dismiss').click()
      await expect(page.getByTestId('settings-api-key-reveal')).toHaveCount(0)
      await expect(createdKeyRow).toBeVisible()
      await expect(page.getByTestId(`settings-api-key-revoke-${createdKeyId}`)).toBeVisible()
      await page.getByTestId(`settings-api-key-revoke-${createdKeyId}`).click()
      await expect(page.getByTestId(`settings-api-key-revoke-${createdKeyId}`)).toContainText('Revoked')

      await page.getByRole('button', { name: /Alerts/ }).click()
      await expect(settingsShell).toHaveAttribute('data-current-tab', 'alerts')
      await expect(page.getByTestId('settings-alert-rules-panel')).toHaveAttribute('data-state', 'ready')
      await expect(page.getByTestId('settings-alert-rules-status-banner')).toContainText('Live alert rules active')
      await expect(page.getByTestId('settings-alert-channels-source-badge')).toContainText('mock-only')
      await expect(page.getByTestId('settings-alert-channels-mock-only-banner')).toContainText('Mock-only shell')

      await page.getByTestId('settings-alert-rules-open-create').click()
      await page.getByTestId('settings-alert-rule-name-input').fill(createdRuleName)
      await page.getByTestId('settings-alert-rule-submit').click()

      const createdRuleRow = page.locator('[data-testid^="settings-alert-rule-row-"]').filter({ hasText: createdRuleName }).first()
      await expect(createdRuleRow).toBeVisible()
      const createdRuleRowTestId = await createdRuleRow.getAttribute('data-testid')
      expect(createdRuleRowTestId).toBeTruthy()
      const createdRuleId = createdRuleRowTestId!.replace('settings-alert-rule-row-', '')

      await page.getByTestId(`settings-alert-rule-toggle-${createdRuleId}`).click()
      await expect(createdRuleRow).toContainText('disabled')
      await page.getByTestId(`settings-alert-rule-delete-${createdRuleId}`).click()
      await expect(createdRuleRow).toHaveCount(0)

      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('GET /api/v1/projects/default/settings'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('GET /api/v1/projects/default/storage'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('POST /api/v1/projects/default/settings'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('GET /api/v1/orgs/default/members'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('POST /api/v1/orgs/default/members'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes(`POST /api/v1/orgs/default/members/${createdMembershipId}/role`))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes(`POST /api/v1/orgs/default/members/${createdMembershipId}/remove`))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('POST /api/v1/projects/default/api-keys'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes(`POST /api/v1/api-keys/${createdKeyId}/revoke`))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes('POST /api/v1/projects/default/alert-rules'))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes(`POST /api/v1/alert-rules/${createdRuleId}/toggle`))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes(`POST /api/v1/alert-rules/${createdRuleId}/delete`))
        .toBe(true)

      expect(runtimeSignals.directBackendRequests, 'Expected settings traffic to stay on same-origin /api/v1').toEqual([])
      expect(filteredConsoleErrors(runtimeSignals), 'Expected live settings happy path without console errors').toEqual([])
      expect(filteredFailedRequests(runtimeSignals), 'Expected live settings happy path without unexpected failed requests').toEqual([])
    } finally {
      const restoreResponse = await request.post('/api/v1/projects/default/settings', {
        data: originalSettings,
      })
      expect(restoreResponse.ok()).toBeTruthy()
      await removeOrgMemberByUserId(request, SEEDED_CANDIDATE_USER_ID)
      await revokeKeyByLabel(request, createdKeyLabel)
      await deleteRuleByName(request, createdRuleName)
    }
  })

  test('admin and ops live settings reject malformed local inputs while keeping Team truthful and same-origin', async ({
    page,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.goto('/settings')

    const settingsShell = page.getByTestId('settings-shell')
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0)
    await expect(page.getByTestId('settings-general-panel')).toHaveAttribute('data-state', 'ready')

    await page.getByTestId('settings-retention-days-input').fill('0')
    await page.getByTestId('settings-sample-rate-input').fill('120')
    await page.getByTestId('settings-general-save').click()
    await expect(settingsShell).toHaveAttribute('data-last-mutation-section', 'general')
    await expect(settingsShell).toHaveAttribute('data-last-mutation-phase', 'failed')
    await expect(page.getByTestId('settings-retention-days-error')).toContainText('positive whole number')
    await expect(page.getByTestId('settings-sample-rate-error')).toContainText('0 to 100')
    expect(runtimeSignals.sameOriginApiCalls.filter((entry) => entry === 'POST /api/v1/projects/default/settings')).toHaveLength(0)

    await page.getByRole('button', { name: /API Keys/ }).click()
    await page.getByTestId('settings-api-keys-open-create').click()
    await page.getByTestId('settings-api-key-submit').click()
    await expect(page.getByTestId('settings-api-key-label-error')).toContainText('Enter a key label')
    expect(runtimeSignals.sameOriginApiCalls.filter((entry) => entry === 'POST /api/v1/projects/default/api-keys')).toHaveLength(0)

    await page.getByRole('button', { name: /Alerts/ }).click()
    await page.getByTestId('settings-alert-rules-open-create').click()
    await page.getByTestId('settings-alert-rule-name-input').fill('Malformed UI rule')
    await page.getByTestId('settings-alert-rule-condition-input').fill('{')
    await page.getByTestId('settings-alert-rule-submit').click()
    await expect(page.getByTestId('settings-alert-rule-condition-error')).toContainText('valid JSON')
    expect(runtimeSignals.sameOriginApiCalls.filter((entry) => entry === 'POST /api/v1/projects/default/alert-rules')).toHaveLength(0)

    await page.getByRole('button', { name: /Team/ }).click()
    await expect(page.getByTestId('settings-team-panel')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('settings-shell-support-badge')).toContainText('live')
    await page.getByTestId('settings-team-open-create').click()
    await page.getByTestId('settings-team-submit').click()
    await expect(page.getByTestId('settings-team-create-error')).toContainText('raw user_id')
    expect(runtimeSignals.sameOriginApiCalls.filter((entry) => entry === 'POST /api/v1/orgs/default/members')).toHaveLength(0)

    expect(filteredConsoleErrors(runtimeSignals), 'Expected malformed-input settings path without console errors').toEqual([])
  })

  test('admin and ops live settings keep the current subsection mounted and show a destructive toast when revoke fails', async ({
    page,
    request,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const failureKeyLabel = `M060 revoke fail ${uniqueSeedSuffix()}`
    const createKeyResponse = await request.post('/api/v1/projects/default/api-keys', {
      data: { label: failureKeyLabel },
    })
    expect(createKeyResponse.ok()).toBeTruthy()

    try {
      await page.route('**/api/v1/api-keys/*/revoke', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'revoke failed' }),
        })
      })

      await page.goto('/settings')
      await page.getByRole('button', { name: /API Keys/ }).click()

      const failureRow = page.locator('[data-testid^="settings-api-key-row-"]').filter({ hasText: failureKeyLabel }).first()
      await expect(failureRow).toBeVisible()
      const failureRowTestId = await failureRow.getAttribute('data-testid')
      expect(failureRowTestId).toBeTruthy()
      const failureKeyId = failureRowTestId!.replace('settings-api-key-row-', '')

      await page.getByTestId(`settings-api-key-revoke-${failureKeyId}`).click()

      const settingsShell = page.getByTestId('settings-shell')
      await expect(settingsShell).toHaveAttribute('data-last-mutation-section', 'api-keys')
      await expect(settingsShell).toHaveAttribute('data-last-mutation-phase', 'failed')
      await expect(page.getByTestId('settings-api-keys-panel')).toHaveAttribute('data-mutation-error-code', 'http')
      await expect(page.getByTestId('settings-api-keys-mutation-error')).toContainText('Last live key write failed')
      await expect(
        page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Revoke API key failed' }),
      ).toBeVisible()
      await expect(failureRow).toBeVisible()
      await expect
        .poll(() => runtimeSignals.sameOriginApiCalls.includes(`POST /api/v1/api-keys/${failureKeyId}/revoke`))
        .toBe(true)
      await expect
        .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes(`/api/v1/api-keys/${failureKeyId}/revoke`)))
        .toBe(true)

      expect(
        filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
        'Expected revoke failure path without unexpected console errors',
      ).toEqual([])
    } finally {
      await revokeKeyByLabel(request, failureKeyLabel)
    }
  })

  test('admin and ops live settings keep zero storage and empty live lists truthful without inventing fallback rows', async ({
    page,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.route('**/api/v1/projects/default/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ retention_days: 30, sample_rate: 1 }),
      })
    })
    await page.route('**/api/v1/projects/default/storage', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ event_count: 0, estimated_bytes: 0 }),
      })
    })
    await page.route('**/api/v1/projects/default/api-keys', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
    await page.route('**/api/v1/projects/default/alert-rules', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/settings')

    await expect(page.getByTestId('settings-general-panel')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('settings-storage-event-count')).toContainText('0')
    await expect(page.getByTestId('settings-storage-estimated-bytes')).toContainText('0 B')

    await page.getByRole('button', { name: /API Keys/ }).click()
    await expect(page.getByTestId('settings-api-keys-panel')).toHaveAttribute('data-active-count', '0')
    await expect(page.getByTestId('settings-api-keys-empty')).toBeVisible()

    await page.getByRole('button', { name: /Alerts/ }).click()
    await expect(page.getByTestId('settings-alert-rules-panel')).toHaveAttribute('data-active-count', '0')
    await expect(page.getByTestId('settings-alert-rules-empty')).toBeVisible()
    await expect(page.getByTestId('settings-alert-channels-mock-only-banner')).toContainText('Mock-only shell')

    expect(filteredConsoleErrors(runtimeSignals), 'Expected empty settings live surfaces without console errors').toEqual([])
    expect(filteredFailedRequests(runtimeSignals), 'Expected empty settings live surfaces without failed requests').toEqual([])
  })
})
