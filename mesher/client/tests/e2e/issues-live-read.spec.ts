import { expect, test } from '@playwright/test'
import { ensureSeededIssueOpen } from './seeded-live-issue'

type RuntimeSignalTracker = {
  consoleErrors: string[]
  failedRequests: string[]
  sameOriginApiPaths: string[]
  directBackendRequests: string[]
}

const SEEDED_ISSUE_TITLE = 'M060 seeded live issue read seam'
const SEEDED_STACK_FILE = 'seed/live-issue-read.ts'
const SEEDED_BREADCRUMB_MESSAGE = 'Seeded live issue read breadcrumb'
const SPARSE_EVENT_ID = 'sparse-live-event-id'

function attachRuntimeSignalTracking(page: import('@playwright/test').Page): RuntimeSignalTracker {
  const runtimeSignals: RuntimeSignalTracker = {
    consoleErrors: [],
    failedRequests: [],
    sameOriginApiPaths: [],
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
    }

    if (url.port === '8080' || url.port === '18080') {
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
      entry.includes('/api/v1/projects/default/')

    return !isExpectedRefreshAbort
  })
}

test.describe('issues live read seam', () => {
  test('issues live read seam boots seeded context and hydrates selected detail through same-origin reads', async ({ page, request }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, {
      title: SEEDED_ISSUE_TITLE,
      fingerprint: 'm060-seeded-live-issue-read-seam',
      stackFile: SEEDED_STACK_FILE,
      breadcrumbMessage: SEEDED_BREADCRUMB_MESSAGE,
      tagValue: 'm060-live-read-seam',
      surface: 'issues-live-read',
    })

    await page.goto('/')

    const issuesShell = page.getByTestId('issues-shell')
    await expect(issuesShell).toHaveAttribute('data-bootstrap-state', 'ready', { timeout: 20_000 })
    await expect(issuesShell).toHaveAttribute('data-overview-source', /(live|mixed)/)
    await expect(issuesShell).toHaveAttribute('data-live-issue-count', /\d+/)
    await expect(page.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible()
    await expect(page.getByTestId('issues-stats-bar')).toBeVisible()
    await expect(page.getByTestId('issues-events-chart')).toBeVisible()
    await expect(page.getByText('Live overview active', { exact: false })).toBeVisible()

    await page.getByTestId(`issue-row-${seeded.issueId}`).click()

    const detailPanel = page.getByTestId('issue-detail-panel')
    await expect(detailPanel).toBeVisible()
    await expect(detailPanel).toHaveAttribute('data-state', 'ready')
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(detailPanel).toHaveAttribute('data-latest-event-id', /.+/)
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(issuesShell).toHaveAttribute('data-selected-issue-state', 'ready')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-source', 'mixed')
    await expect(page.getByTestId('issue-detail-live-banner')).toContainText('Live event detail + timeline active')
    await expect(page.getByTestId('issue-detail-recent-events')).toBeVisible()
    await expect(detailPanel).toContainText(SEEDED_STACK_FILE)

    await page.getByRole('button', { name: 'Breadcrumbs' }).click()
    await expect(detailPanel).toContainText(SEEDED_BREADCRUMB_MESSAGE)
    await page.getByRole('button', { name: 'Context' }).click()
    await expect(detailPanel).toContainText('seed_case:m060-live-read-seam')
    await expect(page.getByRole('button', { name: 'AI Analysis' })).toBeVisible()

    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes('/api/v1/projects/default/issues'))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/issues/${seeded.issueId}/events`))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/events/${seeded.eventId}`))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/issues/${seeded.issueId}/timeline`))
      .toBe(true)

    expect(
      runtimeSignals.directBackendRequests,
      'Expected browser traffic to stay on same-origin /api/v1 instead of calling Mesher directly',
    ).toEqual([])
    expect(filteredConsoleErrors(runtimeSignals), 'Expected seeded detail hydration without console errors').toEqual([])
    expect(filteredFailedRequests(runtimeSignals), 'Expected seeded detail hydration without unexpected failed requests').toEqual([])
  })

  test('issues live read seam exposes explicit fallback state when bootstrap fails', async ({ page }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.route('**/api/v1/projects/default/dashboard/health', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'health unavailable' }),
      })
    })

    await page.goto('/')

    const issuesShell = page.getByTestId('issues-shell')
    await expect(issuesShell).toHaveAttribute('data-bootstrap-state', 'failed')
    await expect(issuesShell).toHaveAttribute('data-overview-source', 'fallback')
    await expect(page.getByTestId('issues-stats-bar')).toHaveAttribute('data-source', 'fallback')
    await expect(page.getByText('Fallback overview active', { exact: false })).toBeVisible()
    await expect
      .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes('/api/v1/projects/default/dashboard/health')))
      .toBe(true)
    expect(
      filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
      'Expected fallback path to avoid unexpected console errors',
    ).toEqual([])
  })

  test('issues live read seam keeps fallback shell sections visible when live detail is sparse', async ({ page, request }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, {
      title: SEEDED_ISSUE_TITLE,
      fingerprint: 'm060-seeded-live-issue-read-seam',
      stackFile: SEEDED_STACK_FILE,
      breadcrumbMessage: SEEDED_BREADCRUMB_MESSAGE,
      tagValue: 'm060-live-read-seam',
      surface: 'issues-live-read',
    })

    await page.route(`**/api/v1/issues/${seeded.issueId}/events?limit=1`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: SPARSE_EVENT_ID,
              issue_id: seeded.issueId,
              level: 'warning',
              message: SEEDED_ISSUE_TITLE,
              tags: { environment: 'sparse-env', surface: 'issues-dashboard' },
              received_at: new Date().toISOString(),
            },
          ],
          has_more: false,
        }),
      })
    })

    await page.route(`**/api/v1/events/${SPARSE_EVENT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          event: {
            id: SPARSE_EVENT_ID,
            project_id: 'default',
            issue_id: seeded.issueId,
            level: 'warning',
            message: SEEDED_ISSUE_TITLE,
            fingerprint: 'sparse-live-detail',
            exception: null,
            stacktrace: [],
            breadcrumbs: [],
            tags: { environment: 'sparse-env', surface: 'issues-dashboard' },
            extra: {},
            user_context: null,
            sdk_name: 'playwright',
            sdk_version: '1.0.0',
            received_at: new Date().toISOString(),
          },
          navigation: {
            next_id: null,
            prev_id: null,
          },
        }),
      })
    })

    await page.route(`**/api/v1/issues/${seeded.issueId}/timeline`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'timeline-entry-1',
            level: 'warning',
            message: 'Sparse live timeline entry',
            received_at: new Date().toISOString(),
          },
        ]),
      })
    })

    await page.goto('/')
    await page.getByTestId(`issue-row-${seeded.issueId}`).click()

    const detailPanel = page.getByTestId('issue-detail-panel')
    await expect(detailPanel).toHaveAttribute('data-state', 'ready')
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(page.getByTestId('issue-detail-live-banner')).toContainText('Live event detail + timeline active')
    await expect(page.getByTestId('issue-detail-recent-events')).toContainText('Sparse live timeline entry')

    await page.getByRole('button', { name: 'Stack Trace' }).click()
    await expect
      .poll(async () => {
        const stackListCount = await page.getByTestId('issue-detail-stack-list').count()
        const stackEmptyCount = await page.getByTestId('issue-detail-stack-empty').count()
        return stackListCount + stackEmptyCount
      })
      .toBe(1)
    await page.getByRole('button', { name: 'Breadcrumbs' }).click()
    await expect
      .poll(async () => {
        const breadcrumbsListCount = await page.getByTestId('issue-detail-breadcrumbs-list').count()
        const breadcrumbsEmptyCount = await page.getByTestId('issue-detail-breadcrumbs-empty').count()
        return breadcrumbsListCount + breadcrumbsEmptyCount
      })
      .toBe(1)
    await page.getByRole('button', { name: 'Context' }).click()
    await expect(detailPanel).toContainText('environment:sparse-env')
    expect(filteredConsoleErrors(runtimeSignals), 'Expected sparse detail overlay without console errors').toEqual([])
  })

  test('issues live read seam shows a visible toast when selected-issue reads fail', async ({ page, request }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, {
      title: SEEDED_ISSUE_TITLE,
      fingerprint: 'm060-seeded-live-issue-read-seam',
      stackFile: SEEDED_STACK_FILE,
      breadcrumbMessage: SEEDED_BREADCRUMB_MESSAGE,
      tagValue: 'm060-live-read-seam',
      surface: 'issues-live-read',
    })

    await page.route(`**/api/v1/issues/${seeded.issueId}/timeline`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'timeline unavailable' }),
      })
    })

    await page.goto('/')
    await page.getByTestId(`issue-row-${seeded.issueId}`).click()

    const issuesShell = page.getByTestId('issues-shell')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-state', 'failed')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-source', 'fallback')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-error-code', 'http')
    await expect(page.getByTestId('issue-detail-panel')).toBeVisible()
    await expect(page.getByTestId('issue-detail-live-banner')).toContainText('Live issue detail unavailable')
    await expect(
      page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Live issue timeline failed' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'AI Analysis' })).toBeVisible()
    await expect(page.getByTestId('issue-detail-close')).toBeVisible()
    await expect
      .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes(`/api/v1/issues/${seeded.issueId}/timeline`)))
      .toBe(true)

    expect(
      filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
      'Expected selected-issue failure path to avoid unexpected console errors',
    ).toEqual([])
  })

  test('issues live read seam normalizes sparse and unknown live overview payloads without crashing', async ({ page }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)

    await page.route('**/api/v1/projects/default/issues', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'live-001',
              title: 'Mesher returned an unknown severity and status',
              level: 'panic',
              status: 'mystery',
              event_count: 7,
              first_seen: new Date(Date.now() - 20 * 60_000).toISOString(),
              last_seen: new Date(Date.now() - 2 * 60_000).toISOString(),
              assigned_to: '',
            },
          ],
          has_more: false,
        }),
      })
    })

    await page.route('**/api/v1/projects/default/dashboard/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ new_today: 0 }),
      })
    })

    await page.route('**/api/v1/projects/default/dashboard/levels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { level: 'panic', count: 3 },
          { level: 'warning', count: 5 },
        ]),
      })
    })

    await page.route('**/api/v1/projects/default/dashboard/volume', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            bucket: new Date(Date.now() - 20 * 60_000).toISOString(),
            count: 6,
          },
          {
            bucket: new Date(Date.now() - 5 * 60_000).toISOString(),
            count: 2,
          },
        ]),
      })
    })

    await page.goto('/')

    const issuesShell = page.getByTestId('issues-shell')
    await expect(issuesShell).toHaveAttribute('data-bootstrap-state', 'ready', { timeout: 20_000 })
    await expect(issuesShell).toHaveAttribute('data-overview-source', 'mixed')
    await expect(page.getByTestId('issues-stats-bar')).toHaveAttribute('data-source', 'mixed')
    await expect(page.getByTestId('issues-stat-card-total-events-source')).toHaveText('fallback')
    await expect(page.getByTestId('issues-stat-card-open-issues-source')).toHaveText('fallback')
    await expect(page.getByTestId('issues-stat-card-critical-issues-source')).toHaveText('derived live')
    await expect(page.getByTestId('issues-events-chart')).toHaveAttribute('data-source', 'mixed')
    await expect(page.getByTestId('issue-row-live-001')).toBeVisible()
    await expect(page.getByText('Live overview active', { exact: false })).toBeVisible()
    expect(filteredConsoleErrors(runtimeSignals), 'Expected mixed normalization path to avoid console errors').toEqual([])
  })
})
