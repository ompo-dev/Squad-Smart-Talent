import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const types = "feat|fix|docs|refactor|test|perf|style|chore|ci|build|revert"
export function validCommitTitle(title) {
  return new RegExp(`^(${types})(\\([a-z0-9][a-z0-9-]*\\))?!?: \\S.{2,}$`).test(title) && !/[\r\n]/.test(title)
}
export function validBranch(branch) {
  return new RegExp(`^(${types})/[a-z0-9]+(?:-[a-z0-9]+)*$`).test(branch)
}
export function checkPullRequest(event) {
  const pr = event.pull_request
  if (!pr) return
  if (!validCommitTitle(pr.title)) throw new Error("PR title must follow Conventional Commits: feat(scope): describe the change")
  const promotion = pr.head.repo?.full_name === pr.base.repo?.full_name && pr.head.ref === "dev" && pr.base.ref === "main"
  if (!promotion && !validBranch(pr.head.ref)) throw new Error("Branch must follow type/short-description, optionally with an issue number")
  if (pr.base.ref === "main" && !promotion && !pr.head.ref.startsWith("fix/")) {
    throw new Error("Target dev for normal contributions; main accepts dev promotions and fix/ hotfixes")
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkPullRequest(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")))
  console.log("Contribution conventions verified")
}
