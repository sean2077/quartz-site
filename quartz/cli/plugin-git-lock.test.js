import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import os from "os"
import path from "path"
import { execFileSync, spawnSync } from "child_process"
import { pathToFileURL } from "url"

const handlerUrl = new URL("./plugin-git-handlers.js", import.meta.url).href

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

function fixture(t, { subdir } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-plugin-lock-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const repo = path.join(root, "upstream with spaces")
  const project = path.join(root, "project")
  fs.mkdirSync(repo)
  fs.mkdirSync(project)
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ version: "1.0.0" }))
  git(repo, "init", "--initial-branch=main")
  git(repo, "config", "user.name", "Quartz tests")
  git(repo, "config", "user.email", "quartz-tests@example.invalid")
  const pluginRoot = subdir ? path.join(repo, subdir) : repo
  fs.mkdirSync(path.join(pluginRoot, "dist"), { recursive: true })
  fs.writeFileSync(
    path.join(pluginRoot, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0" }),
  )
  fs.writeFileSync(path.join(pluginRoot, "package-lock.json"), "{}\n")
  fs.writeFileSync(path.join(pluginRoot, "dist", "index.js"), "export const marker = 'old'\n")
  fs.writeFileSync(path.join(pluginRoot, "dist", "index.d.ts"), "export {}\n")
  git(repo, "add", ".")
  git(repo, "commit", "-m", "old plugin")
  const old = git(repo, "rev-parse", "HEAD")
  fs.writeFileSync(path.join(pluginRoot, "dist", "index.js"), "export const marker = 'new'\n")
  fs.writeFileSync(path.join(pluginRoot, "package-lock.json"), '{"changed":true}\n')
  git(repo, "add", ".")
  git(repo, "commit", "-m", "new plugin")
  const latest = git(repo, "rev-parse", "HEAD")
  const pluginDir = path.join(project, ".quartz", "plugins", "fixture")
  const url = pathToFileURL(repo).href
  const writeLock = (commit = old) => {
    const entry = {
      source: url,
      resolved: url,
      ref: "main",
      commit,
      ...(subdir && { subdir }),
    }
    fs.writeFileSync(
      path.join(project, "quartz.lock.json"),
      JSON.stringify({ version: "1.0.0", plugins: { fixture: entry } }),
    )
  }
  writeLock()
  return { root, repo, project, pluginRoot, pluginDir, url, old, latest, writeLock }
}

function install(project, options = {}) {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { handlePluginInstallUnified } from ${JSON.stringify(handlerUrl)}; await handlePluginInstallUnified(${JSON.stringify(options)});`,
    ],
    {
      cwd: project,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        npm_config_audit: "false",
        npm_config_fund: "false",
        npm_config_update_notifier: "false",
      },
    },
  )
}

function successful(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`)
}

for (const clean of [false, true]) {
  test(`${clean ? "clean" : "default"} restore fetches a pin older than the shallow branch tip`, (t) => {
    const f = fixture(t)
    successful(install(f.project, { clean }))
    assert.equal(git(f.pluginDir, "rev-parse", "HEAD"), f.old)
    assert.match(fs.readFileSync(path.join(f.pluginDir, "dist", "index.js"), "utf8"), /'old'/)
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(f.project, "quartz.lock.json"), "utf8")).plugins.fixture
        .commit,
      f.old,
    )
  })

  test(`${clean ? "clean" : "default"} subdirectory restore extracts the locked commit`, (t) => {
    const f = fixture(t, { subdir: "packages/example" })
    successful(install(f.project, { clean }))
    assert.match(fs.readFileSync(path.join(f.pluginDir, "dist", "index.js"), "utf8"), /'old'/)
    assert.equal(JSON.parse(fs.readFileSync(`${f.pluginDir}.pin.json`, "utf8")).commit, f.old)
    assert.equal(fs.existsSync(path.join(f.pluginDir, ".git")), false)
  })
}

test("updating a shallow cache fetches the exact older pin and discards build lockfile changes", (t) => {
  const f = fixture(t)
  fs.mkdirSync(path.dirname(f.pluginDir), { recursive: true })
  git(f.project, "clone", "--depth", "1", "--", f.url, f.pluginDir)
  fs.writeFileSync(path.join(f.pluginDir, "package-lock.json"), '{"modifiedByBuild":true}\n')
  successful(install(f.project))
  assert.equal(git(f.pluginDir, "rev-parse", "HEAD"), f.old)
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(f.pluginDir, "package-lock.json"), "utf8")),
    {},
  )
})

test("a cached extracted plugin is refreshed when the lock changes or its pin metadata is missing", (t) => {
  const f = fixture(t, { subdir: "packages/example" })
  successful(install(f.project))
  f.writeLock(f.latest)
  successful(install(f.project))
  assert.match(fs.readFileSync(path.join(f.pluginDir, "dist", "index.js"), "utf8"), /'new'/)
  fs.rmSync(`${f.pluginDir}.pin.json`)
  f.writeLock()
  successful(install(f.project))
  assert.match(fs.readFileSync(path.join(f.pluginDir, "dist", "index.js"), "utf8"), /'old'/)
})

test("--clean keeps its documented skip-existing behavior", (t) => {
  const f = fixture(t)
  fs.mkdirSync(f.pluginDir, { recursive: true })
  fs.writeFileSync(path.join(f.pluginDir, "keep.txt"), "existing cache")
  successful(install(f.project, { clean: true }))
  assert.equal(fs.readFileSync(path.join(f.pluginDir, "keep.txt"), "utf8"), "existing cache")
})

test("unavailable or invalid pins fail the command without leaving a branch-tip cache", (t) => {
  const f = fixture(t)
  for (const commit of ["0".repeat(40), "unknown", "HEAD; exit 0"]) {
    f.writeLock(commit)
    const result = install(f.project)
    assert.notEqual(result.status, 0, result.stdout)
    assert.match(result.stderr, /plugin\(s\) failed to install or build/)
    assert.equal(fs.existsSync(f.pluginDir), false)
  }
})

test("an unversioned existing cache does not satisfy an unknown lockfile pin", (t) => {
  const f = fixture(t)
  fs.mkdirSync(path.dirname(f.pluginDir), { recursive: true })
  fs.cpSync(f.pluginRoot, f.pluginDir, { recursive: true })
  fs.rmSync(path.join(f.pluginDir, ".git"), { recursive: true })
  f.writeLock("unknown")
  const result = install(f.project)
  assert.notEqual(result.status, 0, result.stdout)
  assert.match(result.stdout, /Invalid locked plugin commit/)
})

test("a plugin build failure is a nonzero command result", (t) => {
  const f = fixture(t)
  fs.rmSync(path.join(f.pluginRoot, "dist"), { recursive: true })
  fs.writeFileSync(
    path.join(f.pluginRoot, "package.json"),
    JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      scripts: { build: 'node -e "process.exit(1)"' },
    }),
  )
  git(f.repo, "add", ".")
  git(f.repo, "commit", "-m", "broken plugin build")
  f.writeLock(git(f.repo, "rev-parse", "HEAD"))
  const result = install(f.project)
  assert.notEqual(result.status, 0, result.stdout)
  assert.match(result.stdout, /build failed/)
  assert.match(result.stderr, /plugin\(s\) failed to install or build/)
})

test("missing local plugins fail without modifying their source", (t) => {
  const f = fixture(t)
  const missing = path.join(f.root, "missing-local")
  fs.writeFileSync(
    path.join(f.project, "quartz.lock.json"),
    JSON.stringify({
      version: "1.0.0",
      plugins: { fixture: { source: missing, resolved: missing, commit: "local" } },
    }),
  )
  const result = install(f.project)
  assert.notEqual(result.status, 0, result.stdout)
  assert.match(result.stdout, /local path missing/)
  assert.match(result.stderr, /plugin\(s\) failed to install or build/)
  assert.equal(fs.existsSync(missing), false)
})
