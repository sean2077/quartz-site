import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import {
  loadExplorerFolderIcons,
  publishedFolderSlugsFromFiles,
  type ExplorerFolderIcon,
} from "./iconData"

const dataPath = ".obsidian/plugins/obsidian-icon-folder/data.json"

function createVault(): string {
  return mkdtempSync(path.join(tmpdir(), "explorer-folder-icons-"))
}

function createDirectory(root: string, relativePath: string) {
  mkdirSync(path.join(root, ...relativePath.split("/")), { recursive: true })
}

function writeVaultFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, ...relativePath.split("/"))
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

function writeIconData(root: string, data: unknown) {
  writeVaultFile(root, dataPath, JSON.stringify(data))
}

function decodeSvg(icon: ExplorerFolderIcon): string {
  assert.ok(icon.kind === "mask" || icon.kind === "image")
  return Buffer.from(icon.src.split(",", 2)[1], "base64").toString("utf8")
}

test("derives every published ancestor folder slug", () => {
  const folders = publishedFolderSlugsFromFiles([
    { slug: "index" },
    { slug: "alpha/note" },
    { slug: "alpha/beta/nested-note" },
    { slug: "gamma/index" },
  ])

  assert.deepEqual([...folders].sort(), ["alpha/beta/index", "alpha/index", "gamma/index"])
})

test("loads published emoji, Lucide, and custom folder icons without leaking other entries", () => {
  const root = createVault()
  try {
    for (const directory of ["0A 收集", "0A 收集/Github Issues", "1Y LeetCode", "Private"]) {
      createDirectory(root, directory)
    }
    writeVaultFile(root, "index.md", "# Home")
    writeVaultFile(
      root,
      ".obsidian/icons/custom/Leetcode.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" id="leetcode"></svg>',
    )
    writeIconData(root, {
      settings: { iconPacksPath: ".obsidian/icons", debugMode: true },
      "0A 收集": "📥",
      "0A 收集/Github Issues": "LiGithub",
      "1Y LeetCode": "CuLeetcode",
      Private: "🔒",
      "index.md": "🏠",
      Missing: "❌",
    })

    const result = loadExplorerFolderIcons({
      contentRoot: root,
      dataPath,
      publishedFolderSlugs: new Set([
        "0a-收集/index",
        "0a-收集/github-issues/index",
        "1y-leetcode/index",
      ]),
    })

    assert.deepEqual(Object.keys(result.icons), [
      "0a-收集/github-issues/index",
      "0a-收集/index",
      "1y-leetcode/index",
    ])
    assert.deepEqual(result.icons["0a-收集/index"], { kind: "text", value: "📥" })
    assert.equal(result.icons["0a-收集/github-issues/index"].kind, "mask")
    assert.match(decodeSvg(result.icons["0a-收集/github-issues/index"]), /lucide-github/)
    assert.equal(result.icons["1y-leetcode/index"].kind, "image")
    assert.match(decodeSvg(result.icons["1y-leetcode/index"]), /id="leetcode"/)
    assert.deepEqual(result.warnings, [])
    assert.equal(result.icons["private/index"], undefined)
    assert.equal(result.icons["index.md/index"], undefined)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("falls back cleanly for missing and invalid Icon Folder data", () => {
  const missingRoot = createVault()
  const invalidRoot = createVault()
  try {
    const missing = loadExplorerFolderIcons({
      contentRoot: missingRoot,
      dataPath,
      publishedFolderSlugs: new Set(),
    })
    assert.deepEqual(missing.icons, {})
    assert.match(missing.warnings[0], /data was not found/)

    writeVaultFile(invalidRoot, dataPath, "{not-json")
    const invalid = loadExplorerFolderIcons({
      contentRoot: invalidRoot,
      dataPath,
      publishedFolderSlugs: new Set(),
    })
    assert.deepEqual(invalid.icons, {})
    assert.match(invalid.warnings[0], /invalid JSON/)
  } finally {
    rmSync(missingRoot, { recursive: true, force: true })
    rmSync(invalidRoot, { recursive: true, force: true })
  }
})

test("omits escaping, conflicting, unknown, and missing custom icon assignments", () => {
  const root = createVault()
  try {
    for (const directory of ["A B", "a-b", "Unknown", "Missing Custom"]) {
      createDirectory(root, directory)
    }
    createDirectory(root, ".obsidian/icons/custom")
    writeIconData(root, {
      settings: { iconPacksPath: ".obsidian/icons" },
      "A B": "📁",
      "a-b": "📂",
      Unknown: "FaThing",
      "Missing Custom": "CuMissing",
      "../Outside": "📦",
    })

    const result = loadExplorerFolderIcons({
      contentRoot: root,
      dataPath,
      publishedFolderSlugs: new Set(["a-b/index", "unknown/index", "missing-custom/index"]),
    })

    assert.deepEqual(result.icons, {})
    assert.ok(result.warnings.some((warning) => warning.includes("escapes the content root")))
    assert.ok(result.warnings.some((warning) => warning.includes('normalize to "a-b/index"')))
    assert.ok(result.warnings.some((warning) => warning.includes("FaThing")))
    assert.ok(result.warnings.some((warning) => warning.includes("CuMissing")))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
