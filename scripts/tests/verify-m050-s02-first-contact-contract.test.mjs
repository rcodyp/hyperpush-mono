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
const clusteredExamplePath = 'website/docs/docs/getting-started/clustered-example/index.md'
const toolingPath = 'website/docs/docs/tooling/index.md'
const starterCommands = [
  'meshc init --clustered',
  'meshc init --template todo-api --db sqlite',
  'meshc init --template todo-api --db postgres',
]
const currentRepoUrl = 'https://github.com/snowdamiz/mesh-lang.git'
const staleRepoUrl = 'https://github.com/hyperpush-org/hyperpush-mono.git'
const currentRepoBlobBase = 'https://github.com/snowdamiz/mesh-lang/blob/main/'
const staleRepoBlobBase = 'https://github.com/hyperpush-org/hyperpush-mono/blob/main/'
const clusteredExampleSqliteReadmeLink = `${currentRepoBlobBase}examples/todo-sqlite/README.md`
const clusteredExamplePostgresReadmeLink = `${currentRepoBlobBase}examples/todo-postgres/README.md`
const clusteredExampleReferenceBackendLink = `${currentRepoBlobBase}reference-backend/README.md`
const readmeClusteredNextStep = '- **Clustered walkthrough:** use `meshc init --clustered` and then follow https://meshlang.dev/docs/getting-started/clustered-example/'
const readmeProofNextStep = '- **Production Backend Proof:** https://meshlang.dev/docs/production-backend-proof/'
const gettingStartedClusteredNextStep = '- [Clustered Example](/docs/getting-started/clustered-example/)'
const gettingStartedProofNextStep = '- [Production Backend Proof](/docs/production-backend-proof/)'
const gettingStartedStarterHeading = '## Choose your next starter'
const clusteredExampleStarterHeading = '## After the scaffold, pick the follow-on starter'
const clusteredExampleProofHeading = '## Need the retained verifier map?'
const clusteredExampleProofPage = '/docs/distributed-proof/'
const toolingDocsVerifierHeading = '## Assembled first-contact docs verifier'
const toolingReleaseRunbookHeading = '## Release Assembly Runbook'
const toolingContractVerifierHeading = '## Assembled contract verifier'
const toolingExampleVerifierHeading = '## Assembled scaffold/example verifier'
const toolingM050VerifierCommand = 'bash scripts/verify-m050-s02.sh'
const toolingM048VerifierCommand = 'bash scripts/verify-m048-s05.sh'
const toolingM049VerifierCommand = 'bash scripts/verify-m049-s05.sh'
const directProofRailMarkers = [
  'scripts/verify-m047-s04.sh',
  'scripts/verify-m047-s05.sh',
  'scripts/verify-m047-s06.sh',
  'e2e_m047_s07',
]

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
  const clusteredExample = readFrom(baseRoot, clusteredExamplePath)
  const tooling = readFrom(baseRoot, toolingPath)

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

  requireIncludes(errors, clusteredExamplePath, clusteredExample, [
    'meshc init --clustered hello_cluster',
    'meshc init --template todo-api --db sqlite my_local_todo',
    'meshc init --template todo-api --db postgres my_shared_todo',
    clusteredExampleStarterHeading,
    clusteredExampleProofHeading,
    '@cluster pub fn add() -> Int do',
    'Node.start_from_env()',
    'meshc cluster status',
    'meshc cluster continuity',
    'meshc cluster diagnostics',
    clusteredExampleSqliteReadmeLink,
    clusteredExamplePostgresReadmeLink,
    clusteredExampleReferenceBackendLink,
    clusteredExampleProofPage,
  ])

  requireIncludes(errors, toolingPath, tooling, [
    '## Install the CLI tools',
    '### Update an installed toolchain',
    '### Creating a New Project',
    ...starterCommands,
    'honest local starter',
    'shared/deployable',
    clusteredExampleSqliteReadmeLink,
    clusteredExamplePostgresReadmeLink,
    clusteredExampleReferenceBackendLink,
    'meshc cluster status',
    'meshc cluster continuity',
    'meshc cluster diagnostics',
    '## Editor Support',
    '### Support tiers',
    '### VS Code',
    '### Neovim',
    '### Best-effort editors',
    'bash scripts/verify-m036-s03.sh',
    toolingDocsVerifierHeading,
    toolingM050VerifierCommand,
    toolingReleaseRunbookHeading,
    toolingContractVerifierHeading,
    toolingM048VerifierCommand,
    toolingExampleVerifierHeading,
    toolingM049VerifierCommand,
  ])

  requireExcludes(errors, readmePath, readme, [staleRepoUrl])
  requireExcludes(errors, gettingStartedPath, gettingStarted, [staleRepoUrl])
  requireExcludes(errors, clusteredExamplePath, clusteredExample, [
    staleRepoBlobBase,
    'execute_declared_work(...)',
    'Work.execute_declared_work',
    ...directProofRailMarkers,
  ])
  requireExcludes(errors, toolingPath, tooling, [staleRepoUrl, staleRepoBlobBase])

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

  requireOrdered(errors, clusteredExamplePath, clusteredExample, [
    'meshc init --clustered hello_cluster',
    clusteredExampleStarterHeading,
    'meshc init --template todo-api --db sqlite my_local_todo',
    'meshc init --template todo-api --db postgres my_shared_todo',
    clusteredExampleProofHeading,
    clusteredExampleProofPage,
  ])

  requireOrdered(errors, toolingPath, tooling, [
    '## Install the CLI tools',
    '### Update an installed toolchain',
    '### Creating a New Project',
    ...starterCommands,
    'Inspect a running clustered app with the same operator order used by the scaffold',
    '## Editor Support',
    toolingDocsVerifierHeading,
    toolingM050VerifierCommand,
    toolingReleaseRunbookHeading,
    toolingContractVerifierHeading,
    toolingM048VerifierCommand,
    toolingExampleVerifierHeading,
    toolingM049VerifierCommand,
  ])

  return errors
}

test('current repo publishes the first-contact starter chooser contract', () => {
  const errors = validateFirstContactContract(root)
  assert.deepEqual(errors, [], errors.join('\n'))
})

test('contract fails closed when README loses the explicit three-way starter split', (t) => {
  const tmpRoot = mkTmpDir(t, 'verify-m050-s02-readme-')
  for (const relativePath of [readmePath, gettingStartedPath, clusteredExamplePath, toolingPath]) {
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
  for (const relativePath of [readmePath, gettingStartedPath, clusteredExamplePath, toolingPath]) {
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
  for (const relativePath of [readmePath, gettingStartedPath, clusteredExamplePath, toolingPath]) {
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

test('contract fails closed when Clustered Example loses scaffold-first starter truth, current repo links, or bounded proof-page handoff', (t) => {
  const tmpRoot = mkTmpDir(t, 'verify-m050-s02-clustered-example-')
  for (const relativePath of [readmePath, gettingStartedPath, clusteredExamplePath, toolingPath]) {
    copyRepoFile(tmpRoot, relativePath)
  }

  let mutatedClusteredExample = readFrom(tmpRoot, clusteredExamplePath)
  mutatedClusteredExample = mutatedClusteredExample.replace(clusteredExampleStarterHeading, '## Pick the next cluster step')
  mutatedClusteredExample = mutatedClusteredExample.replace(
    'meshc init --template todo-api --db sqlite my_local_todo',
    'meshc init --template todo-api my_local_todo',
  )
  mutatedClusteredExample = mutatedClusteredExample.replace(clusteredExampleSqliteReadmeLink, `${staleRepoBlobBase}examples/todo-sqlite/README.md`)
  mutatedClusteredExample = mutatedClusteredExample.replace(clusteredExampleProofHeading, '## Need direct proof rails right now?')
  mutatedClusteredExample = mutatedClusteredExample.replaceAll(clusteredExampleProofPage, 'bash scripts/verify-m047-s04.sh')
  writeTo(tmpRoot, clusteredExamplePath, mutatedClusteredExample)

  const errors = validateFirstContactContract(tmpRoot)
  assert.ok(errors.some((error) => error.includes('website/docs/docs/getting-started/clustered-example/index.md missing "## After the scaffold, pick the follow-on starter"') || error.includes('website/docs/docs/getting-started/clustered-example/index.md missing ordered marker "## After the scaffold, pick the follow-on starter"')), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes('website/docs/docs/getting-started/clustered-example/index.md missing "meshc init --template todo-api --db sqlite my_local_todo"') || error.includes('website/docs/docs/getting-started/clustered-example/index.md missing ordered marker "meshc init --template todo-api --db sqlite my_local_todo"')), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/clustered-example/index.md missing ${JSON.stringify(clusteredExampleProofHeading)}`) || error.includes(`website/docs/docs/getting-started/clustered-example/index.md missing ordered marker ${JSON.stringify(clusteredExampleProofHeading)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/clustered-example/index.md missing ${JSON.stringify(clusteredExampleProofPage)}`) || error.includes(`website/docs/docs/getting-started/clustered-example/index.md missing ordered marker ${JSON.stringify(clusteredExampleProofPage)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/clustered-example/index.md missing ${JSON.stringify(clusteredExampleSqliteReadmeLink)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/clustered-example/index.md still contains stale text ${JSON.stringify(staleRepoBlobBase)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/getting-started/clustered-example/index.md still contains stale text ${JSON.stringify('scripts/verify-m047-s04.sh')}`)), errors.join('\n'))
})

test('contract fails closed when Tooling loses first-contact ordering, docs-verifier discoverability, or retained editor markers', (t) => {
  const tmpRoot = mkTmpDir(t, 'verify-m050-s02-tooling-')
  for (const relativePath of [readmePath, gettingStartedPath, clusteredExamplePath, toolingPath]) {
    copyRepoFile(tmpRoot, relativePath)
  }

  let mutatedTooling = readFrom(tmpRoot, toolingPath)
  mutatedTooling = mutatedTooling.replace(
    '# Developer Tools\n\n',
    '# Developer Tools\n\n## Release Assembly Runbook\n\n',
  )
  mutatedTooling = mutatedTooling.replace('### Support tiers', '### Editor tiers')
  mutatedTooling = mutatedTooling.replace(toolingDocsVerifierHeading, '## Docs verifier')
  mutatedTooling = mutatedTooling.replace(toolingM050VerifierCommand, toolingM048VerifierCommand)
  mutatedTooling = mutatedTooling.replace(toolingM049VerifierCommand, 'bash scripts/verify-m049-s04.sh')
  mutatedTooling = mutatedTooling.replace(clusteredExamplePostgresReadmeLink, `${staleRepoBlobBase}examples/todo-postgres/README.md`)
  writeTo(tmpRoot, toolingPath, mutatedTooling)

  const errors = validateFirstContactContract(tmpRoot)
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/tooling/index.md missing ${JSON.stringify('### Support tiers')}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/tooling/index.md missing ${JSON.stringify(toolingDocsVerifierHeading)}`) || error.includes(`website/docs/docs/tooling/index.md missing ordered marker ${JSON.stringify(toolingDocsVerifierHeading)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/tooling/index.md missing ${JSON.stringify(toolingM050VerifierCommand)}`) || error.includes(`website/docs/docs/tooling/index.md missing ordered marker ${JSON.stringify(toolingM050VerifierCommand)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/tooling/index.md missing ${JSON.stringify(toolingM049VerifierCommand)}`) || error.includes(`website/docs/docs/tooling/index.md missing ordered marker ${JSON.stringify(toolingM049VerifierCommand)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes(`website/docs/docs/tooling/index.md still contains stale text ${JSON.stringify(staleRepoBlobBase)}`)), errors.join('\n'))
  assert.ok(errors.some((error) => error.includes('website/docs/docs/tooling/index.md drifted order around') || error.includes(`website/docs/docs/tooling/index.md missing ordered marker ${JSON.stringify(toolingDocsVerifierHeading)}`)), errors.join('\n'))
})
