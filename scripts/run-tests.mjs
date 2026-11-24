import { spawn } from "node:child_process"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const testFiles = []

async function collectTests(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    // Do not walk caches, dependencies or symlinks into other repositories.
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectTests(filename)
    } else if (entry.isFile() && /\.test\.(?:ts|js)$/u.test(entry.name)) {
      testFiles.push(filename)
    }
  }
}

await collectTests(path.join(root, "quartz"))
await collectTests(path.join(root, "plugins", "local"))
testFiles.sort()
if (testFiles.length === 0) throw new Error("No project test files were found")

// Older supported Node 22 versions do not automatically discover .test.ts.
// Pass explicit paths to Node while tsx handles loading TypeScript, without
// depending on the tsx CLI's IPC server or shell-specific glob expansion.
console.log(`Running ${testFiles.length} project test files`)
const child = spawn(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
})
child.on("error", (error) => {
  console.error(`Failed to start the test runner: ${error.message}`)
  process.exitCode = 1
})
child.on("close", (code) => {
  process.exitCode = code ?? 1
})
