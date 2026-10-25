import { test } from "node:test"
import assert from "node:assert/strict"
import { ciReadings } from "../scripts/ci-fixture.mjs"
import { validBranch, validCommitTitle, checkPullRequest } from "../scripts/check-conventions.mjs"

test("CI fixture satisfies integration contracts without external data", () => {
  const rows = ciReadings()
  assert.equal(rows.length, 4000)
  assert.equal(new Set(rows.map(row => row[0])).size, 4000)
  assert.equal(new Set(rows.map(row => row[1])).size, 24)
  assert.equal(new Set(rows.map(row => row[2].toISOString().slice(0, 10))).size, 14)
  assert.ok(rows.some(row => row[1] === 22 && row[3] >= 100))
})
test("commit and branch rules accept conventions and reject ambiguous input", () => {
  for (const title of ["feat(api): adicionar filtro", "fix!: alterar contrato", "docs: melhorar guia"]) assert.ok(validCommitTitle(title))
  for (const title of ["update", "feat: ", "feat: teste\nmalicioso", "fix(): descricao"]) assert.equal(validCommitTitle(title), false)
  for (const branch of ["feat/42-filtro-maquina", "docs/guia", "fix/corrigir-job"]) assert.ok(validBranch(branch))
  for (const branch of ["feature/Filtro", "main", "feat/../main", "feat/dois--hifens"]) assert.equal(validBranch(branch), false)
})
test("normal PRs target dev; same-repository promotion and hotfix target main", () => {
  const pr = (head, base, repo = "ompo-dev/Squad-Smart-Talent") => ({ pull_request: { title: "feat(api): adicionar filtro", head: { ref: head, repo: { full_name: repo } }, base: { ref: base, repo: { full_name: "ompo-dev/Squad-Smart-Talent" } } } })
  assert.doesNotThrow(() => checkPullRequest(pr("feat/42-filtro", "dev")))
  assert.doesNotThrow(() => checkPullRequest(pr("dev", "main")))
  assert.doesNotThrow(() => checkPullRequest(pr("fix/hotfix", "main")))
  assert.throws(() => checkPullRequest(pr("dev", "main", "other/fork")))
  assert.throws(() => checkPullRequest(pr("feat/42-filtro", "main")))
  assert.doesNotThrow(() => checkPullRequest({}))
})

test("Dependabot action updates are accepted only from the trusted same-repository bot", () => {
  const repo = { full_name: "ompo-dev/Squad-Smart-Talent" }
  const event = { pull_request: { title: "ci(deps): bump actions/checkout", user: { login: "dependabot[bot]" }, head: { ref: "dependabot/github_actions/actions/checkout-next", repo }, base: { ref: "dev", repo } } }
  assert.doesNotThrow(() => checkPullRequest(event))
  event.pull_request.user.login = "someone-else"
  assert.throws(() => checkPullRequest(event))
  event.pull_request.user.login = "dependabot[bot]"
  event.pull_request.head.repo = { full_name: "other/fork" }
  assert.throws(() => checkPullRequest(event))
})
