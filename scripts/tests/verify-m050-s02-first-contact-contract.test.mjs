import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..', '..')

const readmePath = 'README.md'
const gettingStartedPath = 'website/docs/docs/getting-started/index.md'
const starterCommands = [
  'meshc init --clustered',
  'meshc init --template todo-api --db sqlite',
  'meshc init --template todo-api --db postgres',
]
const currentRepoUrl = 'https://github.com/snowdamiz/mesh-lang.git'
const staleRepoUrl = 'https://github.com/hyperpush-org/hyperpush-mono.git'
const readmeClusteredNextStep = '- **Clustered walkthrough:** use `meshc init --clustered` and then follow https://meshlang.dev/docs/getting-started/clustered-example/'
const readmeProofNextStep = '- **Production Backend Proof:** https://meshlang.dev/docs/production-backend-proof/'
const gettingStartedClusteredNextStep = '- [Clustered Example](/docs/getting-started/clustered-example/)'
const gettingStartedProofNextStep = '- [Production Backend Proof](/docs/production-backend-proof/)'
const gettingStartedStarterHeading = '## Choose your next starter'

function readFrom(baseRoot, relativePath) {
  const absolutePath = path.join(baseRoot, relativePath)
  assert.ok(fs.existsSync(absolutePath), `missing ${relativePath}`)
  return fs.readFileSync(absolutePath, 'utf8')
}

function writeTo(baseRoot, relativePath, content) {
  const absolutePath = path.join(baseRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content)
}

function copyRepoFile(baseRoot, relativePath) {
  writeTo(baseRoot, relativePath, readFrom(root, relativePath))
}

function mkTmpDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

function requireIncludes(errors, relativePath, text, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) {
      errors.push(`${relativePath} missing ${JSON.stringify(needle)}`)
    }
  }
}

function requireExcludes(errors, relativePath, text, needles) {
  for (const needle of needles) {
    if (text.includes(needle)) {
      errors.push(`${relativePath} still contains stale text ${JSON.stringify(needle)}`)
    }
  }
}

function requireOrdered(errors, relativePath, text, labels) {
  let previousIndex = -1
  for (const label of labels) {
    const index = text.indexOf(label)
    if (index === -1) {
      errors.push(`${relativePath} missing ordered marker ${JSON.stringify(label)}`)
      return
    }
    if (index <= previousIndex) {
      errors.push(`${relativePath} drifted order around ${JSON.stringify(label)}`)
      return
    }
    previousIndex = index
  }
}

function validateFirstContactContract(baseRoot) {
  const errors = []
  const readme = readFrom(baseRoot, readmePath)
  const gettingStarted = readFrom(baseRoot, gettingStartedPath)

  requireIncludes(errors, readmePath, readme, [
    ...starterCommands,
    'honest local starter',
    'shared/deployable',
    readmeClusteredNextStep,
    readmeProofNextStep,
  ])

  requireIncludes(errors, gettingStartedPath, gettingStarted, [
    ...starterCommands,
    gettingStartedStarterHeading,
    'honest local starter',
    'shared/deployable',
    currentRepoUrl,
    'reference-backend/README.md',
    gettingStartedClusteredNextStep,
    gettingStartedProofNextStep,
  ])

  requireExcludes(errors, readmePath, readme, [staleRepoUrl])
  requireExcludes(errors, gettingStartedPath, gettingStarted, [staleRepoUrl])

  requireOrdered(errors, readmePath, readme, [
    'meshc init hello_mesh',
    ...starterCommands,
    readmeClusteredNextStep,
    readmeProofNextStep,
  ])

  requireOrdered(errors, gettingStartedPath, gettingStarted, [
    '## Hello World',
    gettingStartedStarterHeading,
    ...starterCommands,
    gettingStartedClusteredNextStep,
    gettingStartedProofNextStep,
  ])

  return errors
}

test('current repo publishes the first-contact starter chooser contract', () => {
  const errors = validateFirstContactContract(root)
  assert.deepEqual(errors, [], errors.join('\n'))
})

test('contract fails closed when README loses the explicit three-way starter split', (t) => {
  const tmpRoot = mkTmpDir(t, 'verify-m050-s02-readme-')
  for (const relativePath of [readmePath, gettingStartedPath]) {
    copyRepoFile(tmpRoot, relativePath)
  }

  let mutatedReadme = readFrom(tmpRoot, readmePath)
  mutatedReadme = mutatedReadme.replace('meshc init --template todo-api --db sqlite', 'meshc init --template todo-api')
  mutatedReadme = mutatedReadme.replace('meshc init --template todo-api --db postgres', 'meshc init postgres_todo')
  mutatedReadme = mutatedReadme.replaceAll('shared/deployable', 'starter')
  writeTo(tmpRoot, readmePath, mutatedReadme)

  const errors = validateFirstContactContract(tmpRoot)
  assert.ok(errors.some((error) => error.includes('README.md missing "meshc init --template todo-api --db sqlite"') || error.includes('README.md missing ordered marker "meshc init --template todo-api --db sqlite"')), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes('README.md missing "meshc init --template todo-api --db postgres"') || error.includes('README.md missing ordered marker "meshc init --template todo-api --db postgres"')), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes('README.md missing "shared/deployable"')), errors.join('\n'))
})

test('contract fails closed when Getting Started loses the chooser heading, repo URL, or split starter commands', (t) => {
  const tmpRoot = mkTmpDir(t, 'verify-m050-s02-getting-started-')
  for (const relativePath of [readmePath, gettingStartedPath]) {
    copyRepoFile(tmpRoot, relativePath)
  }

  let mutatedGettingStarted = readFrom(tmpRoot, gettingStartedPath)
  mutatedGettingStarted = mutatedGettingStarted.replace(gettingStartedStarterHeading, '## Starter paths')
  mutatedGettingStarted = mutatedGettingStarted.replace(currentRepoUrl, staleRepoUrl)
  mutatedGettingStarted = mutatedGettingStarted.replace('meshc init --template todo-api --db sqlite', 'meshc init --template todo-api')
  writeTo(tmpRoot, gettingStartedPath, mutatedGettingStarted)

  const errors = validateFirstContactContract(tmpRoot)
  assert.ok(errors.some((error) => error.includes('website/docs/docs/getting-started/index.md missing "## Choose your next starter"') || error.includes('website/docs/docs/getting-started/index.md missing ordered marker "## Choose your next starter"')), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes('website/docs/docs/getting-started/index.md missing "meshc init --template todo-api --db sqlite"') || error.includes('website/docs/docs/getting-started/index.md missing ordered marker "meshc init --template todo-api --db sqlite"')), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/index.md missing ${JSON.stringify(currentRepoUrl)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/index.md still contains stale text ${JSON.stringify(staleRepoUrl)}`)), errors.join('\n'))
})

test('contract fails closed when proof pages drift back above the starter chooser', (t) => {
  const tmpRoot = mkTmpDir(t, 'verify-m050-s02-order-')
  for (const relativePath of [readmePath, gettingStartedPath]) {
    copyRepoFile(tmpRoot, relativePath)
  }

  let mutatedGettingStarted = readFrom(tmpRoot, gettingStartedPath)
  mutatedGettingStarted = mutatedGettingStarted.replace(
    '# Getting Started\n\n',
    `# Getting Started\n\n- [Production Backend Proof](/docs/production-backend-proof/)\n\n`,
  )
  mutatedGettingStarted = mutatedGettingStarted.replace(
    gettingStartedClusteredNextStep,
    gettingStartedProofNextStep,
  )
  mutatedGettingStarted = mutatedGettingStarted.replace(
    gettingStartedProofNextStep,
    gettingStartedClusteredNextStep,
  )
  writeTo(tmpRoot, gettingStartedPath, mutatedGettingStarted)

  const errors = validateFirstContactContract(tmpRoot)
  assert.ok(errors.some((error) => error.includes('website/docs/docs/getting-started/index.md drifted order around')), errors.join('\n'))
})
