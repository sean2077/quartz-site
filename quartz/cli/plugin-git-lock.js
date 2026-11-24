import fs from "fs"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)
const commitPattern = /^[0-9a-f]{40}$/i

export function assertCommit(commit) {
  if (typeof commit !== "string" || !commitPattern.test(commit)) {
    throw new Error(`Invalid locked plugin commit: ${JSON.stringify(commit)}`)
  }
  return commit.toLowerCase()
}

function assertRepository(url) {
  if (typeof url !== "string" || !url || url.startsWith("-") || url.includes("\0")) {
    throw new Error("Invalid plugin repository URL")
  }
  return url
}

async function git(args, cwd) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  return stdout.trim()
}

/** Fetch the exact object, even when it is no longer the tip of a shallow clone. */
export async function checkoutPinnedCommitAsync(dir, commit, url = "origin") {
  const pin = assertCommit(commit)
  await git(["fetch", "--depth", "1", "--", assertRepository(url), pin], dir)
  // Plugin caches are disposable. npm can modify tracked lockfiles while building them.
  await git(["checkout", "--quiet", "--force", "--detach", pin], dir)
  const actual = await git(["rev-parse", "HEAD"], dir)
  if (actual !== pin) throw new Error(`Plugin checkout mismatch: expected ${pin}, got ${actual}`)
  return pin
}

async function cloneRepository({ url, ref, commit, dir }) {
  assertRepository(url)
  const pin = commit === undefined && commitPattern.test(ref ?? "") ? ref : commit
  if (pin !== undefined) assertCommit(pin)
  const branch = pin === undefined && ref ? ["--branch", ref] : []
  await git(["clone", "--depth", "1", ...branch, "--", url, dir])
  return pin === undefined
    ? git(["rev-parse", "HEAD"], dir)
    : checkoutPinnedCommitAsync(dir, pin, url)
}

/** Only publish a fresh cache directory after its locked commit has been verified. */
export async function cloneAtCommitAsync({ url, commit, pluginDir }) {
  assertCommit(commit)
  fs.mkdirSync(path.dirname(pluginDir), { recursive: true })
  const temporary = fs.mkdtempSync(path.join(path.dirname(pluginDir), ".quartz-clone-"))
  try {
    const dir = path.join(temporary, "repo")
    await cloneRepository({ url, commit, dir })
    fs.renameSync(dir, pluginDir)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

const pinPath = (pluginDir) => `${pluginDir}.pin.json`

/** Extracted subdirectory plugins have no .git, so retain their source identity separately. */
export function isSubdirAtCommit(pluginDir, entry) {
  try {
    const pin = JSON.parse(fs.readFileSync(pinPath(pluginDir), "utf8"))
    return (
      pin.commit === assertCommit(entry.commit) &&
      pin.url === entry.resolved &&
      pin.subdir === entry.subdir &&
      fs.existsSync(path.join(pluginDir, "package.json"))
    )
  } catch {
    return false
  }
}

export async function cloneWithSubdirAsync({ url, ref, commit, subdir, pluginDir }) {
  if (typeof subdir !== "string" || !subdir || path.isAbsolute(subdir)) {
    throw new Error("Plugin subdirectory must be a relative path inside its repository")
  }
  fs.mkdirSync(path.dirname(pluginDir), { recursive: true })
  const temporary = fs.mkdtempSync(path.join(path.dirname(pluginDir), ".quartz-subdir-"))
  try {
    const dir = path.join(temporary, "repo")
    const resolvedCommit = await cloneRepository({ url, ref, commit, dir })
    const subdirPath = fs.realpathSync(path.resolve(dir, subdir))
    const relative = path.relative(fs.realpathSync(dir), subdirPath)
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Plugin subdirectory resolves outside its repository")
    }
    if (!fs.statSync(subdirPath).isDirectory())
      throw new Error("Plugin subdirectory is not a directory")
    const extracted = path.join(temporary, "plugin")
    fs.cpSync(subdirPath, extracted, { recursive: true })
    fs.rmSync(pluginDir, { recursive: true, force: true })
    fs.renameSync(extracted, pluginDir)
    fs.writeFileSync(
      pinPath(pluginDir),
      JSON.stringify({ url, commit: resolvedCommit, subdir }) + "\n",
    )
    return resolvedCommit
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
