import { expect } from '@playwright/test'

export const DEFAULT_API_KEY = 'mshr_devdefaultapikey000000000000000000000000000'
export const ISSUE_STATUS_ORDER = ['unresolved', 'resolved', 'archived'] as const

export type BackendIssueStatus = (typeof ISSUE_STATUS_ORDER)[number]

export type SeededIssueLookup = {
  issueId: string
  eventId: string
}

export type SeededIssueSpec = {
  title: string
  fingerprint: string
  stackFile: string
  breadcrumbMessage: string
  tagValue: string
  surface: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function findIssueByTitleAndStatus(
  request: import('@playwright/test').APIRequestContext,
  title: string,
  status: BackendIssueStatus,
) {
  const issuesResponse = await request.get(`/api/v1/projects/default/issues?status=${status}`)
  expect(issuesResponse.ok()).toBeTruthy()
  const issuesPayload = await issuesResponse.json()
  const seededIssue = issuesPayload.data.find(
    (issue: { id?: string; title?: string }) => issue.title === title,
  )

  if (!seededIssue || typeof seededIssue.id !== 'string') {
    return null
  }

  return {
    issueId: seededIssue.id,
    status,
  }
}

async function findIssueByTitle(
  request: import('@playwright/test').APIRequestContext,
  title: string,
) {
  for (const status of ISSUE_STATUS_ORDER) {
    const seededIssue = await findIssueByTitleAndStatus(request, title, status)
    if (seededIssue) {
      return seededIssue
    }
  }

  return null
}

async function latestEventIdForIssue(
  request: import('@playwright/test').APIRequestContext,
  issueId: string,
) {
  const latestEventResponse = await request.get(`/api/v1/issues/${issueId}/events?limit=1`)
  expect(latestEventResponse.ok()).toBeTruthy()
  const latestEventPayload = await latestEventResponse.json()
  const latestEvent = latestEventPayload.data[0]

  expect(latestEvent, 'Expected seeded issue to have a latest event').toBeTruthy()
  expect(typeof latestEvent.id).toBe('string')

  return latestEvent.id as string
}

async function createSeededIssue(
  request: import('@playwright/test').APIRequestContext,
  spec: SeededIssueSpec,
) {
  const ingestResponse = await request.post('/api/v1/events', {
    headers: {
      'content-type': 'application/json',
      'x-sentry-auth': DEFAULT_API_KEY,
    },
    data: {
      message: spec.title,
      level: 'error',
      fingerprint: spec.fingerprint,
      stacktrace: [
        {
          filename: spec.stackFile,
          function_name: 'seedLiveIssueSeam',
          lineno: 42,
          colno: 7,
          context_line: `throw new Error(${JSON.stringify(spec.title)})`,
          in_app: true,
        },
      ],
      breadcrumbs: [
        {
          timestamp: '2026-04-11T12:00:00.000Z',
          category: 'seed',
          message: spec.breadcrumbMessage,
          level: 'error',
          data: '{}',
        },
      ],
      tags: JSON.stringify({
        environment: 'seeded-local',
        seed_case: spec.tagValue,
        surface: 'issues-dashboard',
      }),
      extra: JSON.stringify({
        seeded_by: 'playwright-seeded-live-issue',
        surface: spec.surface,
      }),
      user_context: JSON.stringify({
        id: 'seed-user',
        username: 'seeded-reader',
      }),
      sdk_name: 'playwright',
      sdk_version: '1.0.0',
    },
  })

  expect(ingestResponse.ok()).toBeTruthy()
  const ingestPayload = await ingestResponse.json()
  expect(['accepted', 'ok']).toContain(ingestPayload.status)

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const currentIssue = await findIssueByTitle(request, spec.title)
    if (currentIssue) {
      return currentIssue
    }

    await sleep(250)
  }

  throw new Error(`Expected seeded issue title ${spec.title} to appear after posting the deterministic seed event`)
}

export async function ensureSeededIssueOpen(
  request: import('@playwright/test').APIRequestContext,
  spec: SeededIssueSpec,
): Promise<SeededIssueLookup> {
  let seededIssue = await findIssueByTitle(request, spec.title)

  if (!seededIssue) {
    seededIssue = await createSeededIssue(request, spec)
  }

  expect(
    seededIssue,
    `Expected seeded issue title ${spec.title} to exist or be creatable through the same-origin seed event flow.`,
  ).toBeTruthy()

  const issueId = seededIssue!.issueId

  if (seededIssue!.status !== 'unresolved') {
    const resetResponse = await request.post(`/api/v1/issues/${issueId}/unresolve`)
    expect(resetResponse.ok()).toBeTruthy()
    const resetPayload = await resetResponse.json()
    expect(['accepted', 'ok']).toContain(resetPayload.status)
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const currentIssue = await findIssueByTitle(request, spec.title)

    if (currentIssue?.issueId === issueId && currentIssue.status === 'unresolved') {
      return {
        issueId,
        eventId: await latestEventIdForIssue(request, issueId),
      }
    }

    await sleep(250)
  }

  throw new Error(`Expected seeded issue ${issueId} to return to unresolved state before the browser proof started`)
}
