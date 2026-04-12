import { expect, test } from '@playwright/test'
import { ensureSeededIssueOpen } from './seeded-live-issue'

const SEEDED_ACTION_ISSUE_TITLE = 'M060 seeded live issue action seam'
const SEEDED_ACTION_STACK_FILE = 'seed/live-issue-action.ts'
const SEEDED_ACTION_ISSUE = {
  title: SEEDED_ACTION_ISSUE_TITLE,
  fingerprint: 'm060-seeded-live-issue-action-seam',
  stackFile: SEEDED_ACTION_STACK_FILE,
  breadcrumbMessage: 'Seeded live issue action breadcrumb',
  tagValue: 'm060-live-action-seam',
  surface: 'issues-live-actions',
} as const

type RuntimeSignalTracker = {
  consoleErrors: string[]
  failedRequests: string[]
  sameOriginApiPaths: string[]
  directBackendRequests: string[]
}

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

function detailActionTestId(action: 'resolve' | 'unresolve' | 'archive') {
  return `issue-detail-action-${action}`
}

test.describe('issues live actions', () => {
  test('issues live actions replay resolve, reopen, and ignore through same-origin mutations while keeping summary markers truthful', async ({
    page,
    request,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, SEEDED_ACTION_ISSUE)

    await page.goto('/')

    const issuesShell = page.getByTestId('issues-shell')
    const detailPanel = page.getByTestId('issue-detail-panel')
    const issueRow = page.getByTestId(`issue-row-${seeded.issueId}`)
    const issueRowStatus = page.getByTestId(`issue-row-status-${seeded.issueId}`)

    await expect(page.getByTestId('issue-action-proof-harness')).toBeHidden()
    await expect(page.getByTestId('issues-stat-card-total-events-source')).toHaveText('live')
    await expect(page.getByTestId('issues-stat-card-open-issues-source')).toHaveText('live')
    await expect(page.getByTestId('issues-stat-card-critical-issues-source')).toHaveText('derived live')
    await expect(page.getByTestId('issues-stat-card-affected-users-source')).toHaveText('fallback')

    await page.getByTestId('issues-status-filter-open').click()
    await expect(issueRow).toBeVisible()
    await expect(issueRowStatus).toContainText('open')

    await issueRow.click()

    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(detailPanel).toContainText(SEEDED_ACTION_STACK_FILE)
    await expect(page.getByTestId(detailActionTestId('resolve'))).toContainText('Resolve')
    await expect(page.getByTestId(detailActionTestId('archive'))).toContainText('Ignore')
    await expect(page.getByTestId('issue-detail-action-source-note')).toContainText('same-origin Mesher seam')
    await expect(page.getByTestId('issue-detail-action-source-note')).toContainText('shell-only helpers')
    await expect(page.getByRole('button', { name: 'AI Analysis' })).toHaveAttribute('data-source', 'shell-only')
    await expect(page.getByTestId('issue-action-proof-harness')).toBeVisible()

    await page.getByTestId(detailActionTestId('resolve')).click()

    await expect.poll(async () => issuesShell.getAttribute('data-last-action')).toBe('resolve')
    await expect.poll(async () => issuesShell.getAttribute('data-issue-action-phase')).toBe('idle')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(detailPanel).toHaveAttribute('data-state', 'ready')
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(issueRow).toBeHidden()

    await page.getByTestId('issues-status-filter-resolved').click()
    await expect(issueRow).toBeVisible()
    await expect(issueRowStatus).toContainText('resolved')
    await expect(issueRow).toContainText('Mesher resolved issue')
    await expect(page.getByTestId(detailActionTestId('unresolve'))).toContainText('Reopen')

    await page.getByTestId(detailActionTestId('unresolve')).click()

    await expect.poll(async () => issuesShell.getAttribute('data-last-action')).toBe('unresolve')
    await expect.poll(async () => issuesShell.getAttribute('data-issue-action-phase')).toBe('idle')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(detailPanel).toHaveAttribute('data-state', 'ready')
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(issueRow).toBeHidden()

    await page.getByTestId('issues-status-filter-open').click()
    await expect(issueRow).toBeVisible()
    await expect(issueRowStatus).toContainText('open')
    await expect(issueRow).toContainText('Mesher unresolved issue')
    await expect(page.getByTestId(detailActionTestId('archive'))).toContainText('Ignore')

    await page.getByTestId(detailActionTestId('archive')).click()

    await expect.poll(async () => issuesShell.getAttribute('data-last-action')).toBe('archive')
    await expect.poll(async () => issuesShell.getAttribute('data-issue-action-phase')).toBe('idle')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(detailPanel).toHaveAttribute('data-state', 'ready')
    await expect(detailPanel).toHaveAttribute('data-source', 'mixed')
    await expect(issueRow).toBeHidden()

    await page.getByTestId('issues-status-filter-ignored').click()
    await expect(issueRow).toBeVisible()
    await expect(issueRowStatus).toContainText('ignored')
    await expect(issueRow).toContainText('Mesher archived issue')

    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/issues/${seeded.issueId}/resolve`))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/issues/${seeded.issueId}/unresolve`))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/issues/${seeded.issueId}/archive`))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.filter((path) => path === '/api/v1/projects/default/issues').length >= 4)
      .toBe(true)

    expect(
      runtimeSignals.directBackendRequests,
      'Expected browser traffic to stay on same-origin /api/v1 instead of calling Mesher directly',
    ).toEqual([])
    expect(filteredConsoleErrors(runtimeSignals), 'Expected live mutation proof path without console errors').toEqual([])
    expect(filteredFailedRequests(runtimeSignals), 'Expected live mutation proof path without unexpected failed requests').toEqual([])
  })

  test('issues live actions disable the supported detail controls while a write is in flight', async ({
    page,
    request,
  }) => {
    const seeded = await ensureSeededIssueOpen(request, SEEDED_ACTION_ISSUE)
    let releaseMutation!: () => void
    const mutationBlocked = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })

    await page.route(`**/api/v1/issues/${seeded.issueId}/resolve`, async (route) => {
      await mutationBlocked
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      })
    })

    await page.goto('/')
    await page.getByTestId('issues-status-filter-open').click()
    await page.getByTestId(`issue-row-${seeded.issueId}`).click()

    const issuesShell = page.getByTestId('issues-shell')
    const detailAction = page.getByTestId(detailActionTestId('resolve'))
    const archiveAction = page.getByTestId(detailActionTestId('archive'))

    await detailAction.click()

    await expect(issuesShell).toHaveAttribute('data-issue-action-phase', 'mutating')
    await expect(detailAction).toBeDisabled()
    await expect(detailAction).toContainText('Resolving…')
    await expect(archiveAction).toBeDisabled()

    releaseMutation()

    await expect.poll(async () => issuesShell.getAttribute('data-issue-action-phase')).toBe('idle')
    await expect(detailAction).toBeEnabled()
  })

  test('issues live actions keep the current issue selected and show a destructive toast when the mutation fails', async ({
    page,
    request,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, SEEDED_ACTION_ISSUE)

    await page.route(`**/api/v1/issues/${seeded.issueId}/resolve`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mutation failed' }),
      })
    })

    await page.goto('/')
    await page.getByTestId('issues-status-filter-open').click()
    await page.getByTestId(`issue-row-${seeded.issueId}`).click()
    await page.getByTestId(detailActionTestId('resolve')).click()

    const issuesShell = page.getByTestId('issues-shell')
    await expect(issuesShell).toHaveAttribute('data-last-action', 'resolve')
    await expect(issuesShell).toHaveAttribute('data-issue-action-phase', 'failed')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-code', 'http')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-stage', 'mutation')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(page.getByTestId('issue-detail-panel')).toBeVisible()
    await expect(page.getByTestId('issue-detail-action-error')).toContainText('Last live action failed (http)')
    await expect(
      page
        .getByRole('region', { name: /Notifications/ })
        .getByRole('listitem')
        .filter({ hasText: 'Resolve failed' }),
    ).toBeVisible()

    await expect
      .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes(`/api/v1/issues/${seeded.issueId}/resolve`)))
      .toBe(true)
    await expect
      .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/issues/${seeded.issueId}/resolve`))
      .toBe(true)

    expect(
      filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
      'Expected mutation failure path to avoid unexpected console errors',
    ).toEqual([])
  })

  test('issues live actions surface overview refresh failures after a nominal ok mutation without silently patching stale detail', async ({
    page,
    request,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, SEEDED_ACTION_ISSUE)
    let failOverviewRefresh = false

    await page.route(`**/api/v1/issues/${seeded.issueId}/resolve`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      })
    })

    await page.route('**/api/v1/projects/default/issues', async (route) => {
      if (!failOverviewRefresh) {
        await route.continue()
        return
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'overview unavailable' }),
      })
    })

    await page.goto('/')
    await page.getByTestId('issues-status-filter-open').click()
    await page.getByTestId(`issue-row-${seeded.issueId}`).click()
    await expect(page.getByTestId('issue-detail-panel')).toHaveAttribute('data-source', 'mixed')

    failOverviewRefresh = true
    await page.getByTestId(detailActionTestId('resolve')).click()

    const issuesShell = page.getByTestId('issues-shell')
    await expect(issuesShell).toHaveAttribute('data-last-action', 'resolve')
    await expect(issuesShell).toHaveAttribute('data-issue-action-phase', 'failed')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-code', 'http')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-stage', 'overview-refresh')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(issuesShell).toHaveAttribute('data-selected-issue-source', 'fallback')
    await expect(page.getByTestId('issue-detail-panel')).toHaveAttribute('data-source', 'fallback')
    await expect(
      page
        .getByRole('region', { name: /Notifications/ })
        .getByRole('listitem')
        .filter({ hasText: 'Resolve applied, but refresh failed' }),
    ).toBeVisible()

    await expect
      .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes('/api/v1/projects/default/issues')))
      .toBe(true)

    expect(
      filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
      'Expected overview refresh failure path to avoid unexpected console errors',
    ).toEqual([])
  })

  test('issues live actions reject unsupported actions and unknown issue ids without issuing ad hoc browser fetches', async ({
    page,
    request,
  }) => {
    const runtimeSignals = attachRuntimeSignalTracking(page)
    const seeded = await ensureSeededIssueOpen(request, SEEDED_ACTION_ISSUE)

    await page.goto('/')
    await page.getByTestId('issues-status-filter-open').click()
    await page.getByTestId(`issue-row-${seeded.issueId}`).click()

    const issuesShell = page.getByTestId('issues-shell')

    await page.getByTestId('issue-action-proof-unsupported').click()
    await expect(issuesShell).toHaveAttribute('data-last-action', 'unsupported-proof')
    await expect(issuesShell).toHaveAttribute('data-issue-action-phase', 'failed')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-code', 'invalid-payload')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-stage', 'mutation')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(page.getByTestId('issue-action-proof-last-action')).toContainText('unsupported-proof')
    await expect(page.getByTestId('issue-action-proof-last-issue')).toContainText(seeded.issueId)
    await expect(page.getByTestId('issue-action-proof-error')).toContainText('invalid-payload')
    await expect(page.getByTestId('issue-action-proof-stage')).toContainText('mutation')
    await expect(
      page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Issue action failed' }),
    ).toBeVisible()

    await page.getByTestId('issue-action-proof-unknown-issue').click()
    await expect(issuesShell).toHaveAttribute('data-last-action', 'resolve')
    await expect(issuesShell).toHaveAttribute('data-issue-action-issue-id', 'missing-live-issue-id')
    await expect(issuesShell).toHaveAttribute('data-issue-action-error-code', 'invalid-payload')
    await expect(issuesShell).toHaveAttribute('data-selected-issue-id', seeded.issueId)
    await expect(page.getByTestId('issue-action-proof-last-action')).toContainText('resolve')
    await expect(page.getByTestId('issue-action-proof-last-issue')).toContainText('missing-live-issue-id')
    await expect(page.getByTestId('issue-action-proof-error')).toContainText('invalid-payload')
    await expect(page.getByTestId('issue-action-proof-stage')).toContainText('mutation')

    expect(
      runtimeSignals.sameOriginApiPaths,
      'Expected unsupported proof paths to stop inside provider validation instead of issuing ad hoc fetches',
    ).not.toContain(`/api/v1/issues/${seeded.issueId}/unsupported-proof`)
    expect(runtimeSignals.sameOriginApiPaths).not.toContain('/api/v1/issues/missing-live-issue-id/resolve')
    expect(filteredConsoleErrors(runtimeSignals), 'Expected local validation failures without console errors').toEqual([])
  })
})
