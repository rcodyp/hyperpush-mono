# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-ops-live.spec.ts >> admin and ops live alerts >> admin and ops live alerts treat malformed live payloads as contract failures instead of guessing shell status
- Location: ../hyperpush-mono/mesher/client/tests/e2e/admin-ops-live.spec.ts:355:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByTestId('alerts-shell')
Expected: "failed"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for getByTestId('alerts-shell')

```

# Page snapshot

```yaml
- generic [active]:
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  284 |         status: 500,
  285 |         contentType: 'application/json',
  286 |         body: JSON.stringify({ error: 'alerts unavailable' }),
  287 |       })
  288 |     })
  289 | 
  290 |     await page.goto('/alerts')
  291 | 
  292 |     const alertsShell = page.getByTestId('alerts-shell')
  293 |     await expect(alertsShell).toHaveAttribute('data-bootstrap-state', 'failed')
  294 |     await expect(alertsShell).toHaveAttribute('data-overview-source', 'fallback')
  295 |     await expect(page.getByTestId('alerts-stats-bar')).toHaveAttribute('data-source', 'fallback')
  296 |     await expect(page.getByText('Fallback alerts active', { exact: false })).toBeVisible()
  297 |     await expect(
  298 |       page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Live alerts failed' }),
  299 |     ).toBeVisible()
  300 |     await expect
  301 |       .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes('/api/v1/projects/default/alerts')))
  302 |       .toBe(true)
  303 | 
  304 |     expect(
  305 |       filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
  306 |       'Expected alerts bootstrap failure path to avoid unexpected console errors',
  307 |     ).toEqual([])
  308 |   })
  309 | 
  310 |   test('admin and ops live alerts keep the selected alert visible and show a destructive toast when a mutation fails', async ({
  311 |     page,
  312 |     request,
  313 |   }) => {
  314 |     test.setTimeout(120_000)
  315 |     const runtimeSignals = attachRuntimeSignalTracking(page)
  316 |     const seeded = await createSeededLiveAlert(request)
  317 | 
  318 |     await page.route(`**/api/v1/alerts/${seeded.alertId}/acknowledge`, async (route) => {
  319 |       await route.fulfill({
  320 |         status: 500,
  321 |         contentType: 'application/json',
  322 |         body: JSON.stringify({ error: 'mutation failed' }),
  323 |       })
  324 |     })
  325 | 
  326 |     await page.goto('/alerts')
  327 |     await page.getByTestId(`alert-row-${seeded.alertId}`).click()
  328 |     await page.getByTestId('alert-detail-action-acknowledge').click()
  329 | 
  330 |     const alertsShell = page.getByTestId('alerts-shell')
  331 |     await expect(alertsShell).toHaveAttribute('data-last-action', 'acknowledge')
  332 |     await expect(alertsShell).toHaveAttribute('data-alert-action-phase', 'failed')
  333 |     await expect(alertsShell).toHaveAttribute('data-alert-action-error-code', 'http')
  334 |     await expect(alertsShell).toHaveAttribute('data-alert-action-error-stage', 'mutation')
  335 |     await expect(alertsShell).toHaveAttribute('data-selected-alert-id', seeded.alertId)
  336 |     await expect(page.getByTestId('alert-detail-panel')).toBeVisible()
  337 |     await expect(page.getByTestId('alert-detail-action-error')).toContainText('Last live action failed (http)')
  338 |     await expect(
  339 |       page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Acknowledge failed' }),
  340 |     ).toBeVisible()
  341 | 
  342 |     await expect
  343 |       .poll(() => runtimeSignals.failedRequests.some((entry) => entry.includes(`/api/v1/alerts/${seeded.alertId}/acknowledge`)))
  344 |       .toBe(true)
  345 |     await expect
  346 |       .poll(() => runtimeSignals.sameOriginApiPaths.includes(`/api/v1/alerts/${seeded.alertId}/acknowledge`))
  347 |       .toBe(true)
  348 | 
  349 |     expect(
  350 |       filteredConsoleErrors(runtimeSignals, ['Failed to load resource: the server responded with a status of 500']),
  351 |       'Expected alert mutation failure path to avoid unexpected console errors',
  352 |     ).toEqual([])
  353 |   })
  354 | 
  355 |   test('admin and ops live alerts treat malformed live payloads as contract failures instead of guessing shell status', async ({
  356 |     page,
  357 |   }) => {
  358 |     const runtimeSignals = attachRuntimeSignalTracking(page)
  359 | 
  360 |     await page.route('**/api/v1/projects/default/alerts', async (route) => {
  361 |       await route.fulfill({
  362 |         status: 200,
  363 |         contentType: 'application/json',
  364 |         body: JSON.stringify([
  365 |           {
  366 |             id: 'malformed-live-alert',
  367 |             rule_id: 'rule-1',
  368 |             project_id: 'default',
  369 |             status: 'mystery',
  370 |             message: 'Malformed alert payload',
  371 |             condition_snapshot: 'not-an-object',
  372 |             triggered_at: 'not-a-timestamp',
  373 |             acknowledged_at: null,
  374 |             resolved_at: null,
  375 |             rule_name: 'Malformed live rule',
  376 |           },
  377 |         ]),
  378 |       })
  379 |     })
  380 | 
  381 |     await page.goto('/alerts')
  382 | 
  383 |     const alertsShell = page.getByTestId('alerts-shell')
> 384 |     await expect(alertsShell).toHaveAttribute('data-bootstrap-state', 'failed')
      |                               ^ Error: expect(locator).toHaveAttribute(expected) failed
  385 |     await expect(alertsShell).toHaveAttribute('data-bootstrap-error-code', 'invalid-payload')
  386 |     await expect(alertsShell).toHaveAttribute('data-overview-source', 'fallback')
  387 |     await expect(page.getByText('Fallback alerts active', { exact: false })).toBeVisible()
  388 |     await expect(
  389 |       page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Live alerts failed' }),
  390 |     ).toBeVisible()
  391 | 
  392 |     expect(filteredConsoleErrors(runtimeSignals), 'Expected malformed alerts payload path without console errors').toEqual([])
  393 |   })
  394 | 
  395 |   test('admin and ops live alerts keep an empty live list truthful without rehydrating fallback rows', async ({ page }) => {
  396 |     const runtimeSignals = attachRuntimeSignalTracking(page)
  397 | 
  398 |     await page.route('**/api/v1/projects/default/alerts', async (route) => {
  399 |       await route.fulfill({
  400 |         status: 200,
  401 |         contentType: 'application/json',
  402 |         body: JSON.stringify([]),
  403 |       })
  404 |     })
  405 | 
  406 |     await page.goto('/alerts')
  407 | 
  408 |     const alertsShell = await waitForAlertsOverviewReady(page)
  409 |     await expect(alertsShell).toHaveAttribute('data-live-alert-count', '0')
  410 |     await expect(alertsShell).toHaveAttribute('data-overview-source', 'mixed')
  411 |     await expect(page.getByTestId('alerts-empty-state')).toBeVisible()
  412 |     await expect(page.getByTestId('alerts-stat-card-total-alerts-source')).toHaveText('derived live')
  413 |     await expect(page.getByText('No alerts found')).toBeVisible()
  414 | 
  415 |     expect(filteredConsoleErrors(runtimeSignals), 'Expected empty live alerts path without console errors').toEqual([])
  416 |     expect(filteredFailedRequests(runtimeSignals), 'Expected empty live alerts path without failed requests').toEqual([])
  417 |   })
  418 | })
  419 | 
  420 | async function fetchProjectSettings(request: import('@playwright/test').APIRequestContext) {
  421 |   const response = await request.get('/api/v1/projects/default/settings')
  422 |   expect(response.ok()).toBeTruthy()
  423 |   return (await response.json()) as { retention_days: number; sample_rate: number }
  424 | }
  425 | 
  426 | async function listProjectApiKeys(request: import('@playwright/test').APIRequestContext) {
  427 |   const response = await request.get('/api/v1/projects/default/api-keys')
  428 |   expect(response.ok()).toBeTruthy()
  429 |   return (await response.json()) as Array<{ id: string; label: string; revoked_at: string | null }>
  430 | }
  431 | 
  432 | async function listProjectAlertRules(request: import('@playwright/test').APIRequestContext) {
  433 |   const response = await request.get('/api/v1/projects/default/alert-rules')
  434 |   expect(response.ok()).toBeTruthy()
  435 |   return (await response.json()) as Array<{ id: string; name: string }>
  436 | }
  437 | 
  438 | async function revokeKeyByLabel(
  439 |   request: import('@playwright/test').APIRequestContext,
  440 |   label: string,
  441 | ) {
  442 |   const keys = await listProjectApiKeys(request)
  443 |   const key = keys.find((entry) => entry.label === label && entry.revoked_at === null)
  444 |   if (!key) {
  445 |     return
  446 |   }
  447 | 
  448 |   const revokeResponse = await request.post(`/api/v1/api-keys/${key.id}/revoke`)
  449 |   expect(revokeResponse.ok()).toBeTruthy()
  450 | }
  451 | 
  452 | async function deleteRuleByName(
  453 |   request: import('@playwright/test').APIRequestContext,
  454 |   name: string,
  455 | ) {
  456 |   const rules = await listProjectAlertRules(request)
  457 |   const rule = rules.find((entry) => entry.name === name)
  458 |   if (!rule) {
  459 |     return
  460 |   }
  461 | 
  462 |   const deleteResponse = await request.post(`/api/v1/alert-rules/${rule.id}/delete`)
  463 |   expect(deleteResponse.ok()).toBeTruthy()
  464 | }
  465 | 
  466 | async function listOrgMembers(request: import('@playwright/test').APIRequestContext) {
  467 |   const response = await request.get('/api/v1/orgs/default/members')
  468 |   expect(response.ok()).toBeTruthy()
  469 |   return (await response.json()) as Array<{
  470 |     id: string
  471 |     user_id: string
  472 |     email: string
  473 |     display_name: string
  474 |     role: string
  475 |   }>
  476 | }
  477 | 
  478 | async function removeOrgMemberByUserId(
  479 |   request: import('@playwright/test').APIRequestContext,
  480 |   userId: string,
  481 | ) {
  482 |   const members = await listOrgMembers(request)
  483 |   const member = members.find((entry) => entry.user_id === userId)
  484 |   if (!member) {
```