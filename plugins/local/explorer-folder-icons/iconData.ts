import { createRequire } from "node:module"
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs"
import path from "node:path"
import type { FilePath } from "@quartz-community/types"
import { slugifyFilePath } from "@quartz-community/utils/path"

const require = createRequire(import.meta.url)

type JsonObject = Record<string, unknown>

export type ExplorerFolderIcon =
  | { kind: "text"; value: string }
  | { kind: "mask"; src: string }
  | { kind: "image"; src: string }

export interface ExplorerFolderIconLoadResult {
  icons: Record<string, ExplorerFolderIcon>
  warnings: string[]
}

export interface ExplorerFolderIconLoadOptions {
  contentRoot: string
  dataPath: string
  publishedFolderSlugs: ReadonlySet<string>
  lucideIconRoot?: string
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeConfiguredPath(value: string): string {
  return value.replace(/[\\/]+/g, path.sep)
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  )
}

function resolveInside(root: string, relativePath: string): string | undefined {
  const candidate = path.resolve(root, normalizeConfiguredPath(relativePath))
  return isWithin(root, candidate) ? candidate : undefined
}

function existingRealPathInside(realRoot: string, candidate: string): string | undefined {
  try {
    const realCandidate = realpathSync(candidate)
    return isWithin(realRoot, realCandidate) ? realCandidate : undefined
  } catch {
    return undefined
  }
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

function splitIconIdentifier(value: string): { prefix: string; name: string } | undefined {
  const nextIdentifier = value.slice(1).search(/[A-Z0-9]/) + 1
  if (nextIdentifier <= 0 || nextIdentifier >= value.length) return undefined

  return {
    prefix: value.slice(0, nextIdentifier),
    name: value.slice(nextIdentifier),
  }
}

export function createIconPackPrefix(iconPackName: string): string {
  if (iconPackName.includes("-")) {
    const segments = iconPackName.split("-")
    return (
      segments[0].charAt(0).toUpperCase() +
      segments
        .slice(1)
        .map((segment) => segment.charAt(0).toLowerCase())
        .join("")
    )
  }

  return iconPackName.charAt(0).toUpperCase() + iconPackName.charAt(1).toLowerCase()
}

function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
}

function defaultLucideIconRoot(): string {
  return path.join(path.dirname(require.resolve("lucide-static/package.json")), "icons")
}

function discoverCustomIconPacks(
  contentRoot: string,
  realContentRoot: string,
  configuredPath: string,
  warnings: Set<string>,
): Map<string, string> {
  const iconPackRoot = resolveInside(contentRoot, configuredPath)
  if (!iconPackRoot) {
    warnings.add(`iconPacksPath escapes the content root: ${configuredPath}`)
    return new Map()
  }

  const realIconPackRoot = existingRealPathInside(realContentRoot, iconPackRoot)
  if (!realIconPackRoot) return new Map()

  let entries
  try {
    entries = readdirSync(realIconPackRoot, { withFileTypes: true })
  } catch {
    return new Map()
  }

  const packs = new Map<string, string>()
  const ambiguousPrefixes = new Set<string>()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const prefix = createIconPackPrefix(entry.name)
    if (ambiguousPrefixes.has(prefix)) continue
    if (packs.has(prefix)) {
      packs.delete(prefix)
      ambiguousPrefixes.add(prefix)
      warnings.add(`Multiple custom icon packs use the prefix "${prefix}"; omitting that prefix`)
      continue
    }

    packs.set(prefix, path.join(realIconPackRoot, entry.name))
  }

  return packs
}

function resolveIcon(
  iconValue: string,
  contentRoot: string,
  realContentRoot: string,
  iconPacksPath: string,
  lucideIconRoot: string,
  warnings: Set<string>,
): ExplorerFolderIcon | undefined {
  const identifier = splitIconIdentifier(iconValue)
  if (!identifier) return { kind: "text", value: iconValue }

  if (identifier.prefix === "Li") {
    const iconPath = resolveInside(lucideIconRoot, `${toKebabCase(identifier.name)}.svg`)
    if (!iconPath) {
      warnings.add(`Lucide icon path is invalid: ${iconValue}`)
      return undefined
    }

    try {
      return { kind: "mask", src: svgDataUrl(readFileSync(iconPath, "utf8")) }
    } catch {
      warnings.add(`Lucide icon was not found: ${iconValue}`)
      return undefined
    }
  }

  const packs = discoverCustomIconPacks(contentRoot, realContentRoot, iconPacksPath, warnings)
  const packPath = packs.get(identifier.prefix)
  if (!packPath) {
    warnings.add(`Icon pack prefix was not found for: ${iconValue}`)
    return undefined
  }

  const iconPath = resolveInside(packPath, `${identifier.name}.svg`)
  if (!iconPath) {
    warnings.add(`Custom icon path is invalid: ${iconValue}`)
    return undefined
  }

  const realIconPath = existingRealPathInside(packPath, iconPath)
  if (!realIconPath) {
    warnings.add(`Custom icon was not found: ${iconValue}`)
    return undefined
  }

  try {
    if (!statSync(realIconPath).isFile()) throw new Error("not a file")
    return { kind: "image", src: svgDataUrl(readFileSync(realIconPath, "utf8")) }
  } catch {
    warnings.add(`Custom icon was not found: ${iconValue}`)
    return undefined
  }
}

export function publishedFolderSlugsFromFiles(
  files: ReadonlyArray<{ slug?: string }>,
): Set<string> {
  const folders = new Set<string>()

  for (const file of files) {
    if (!file.slug) continue
    const segments = file.slug.split("/").filter(Boolean)
    for (let index = 1; index < segments.length; index++) {
      folders.add(`${segments.slice(0, index).join("/")}/index`)
    }
  }

  return folders
}

export function loadExplorerFolderIcons({
  contentRoot,
  dataPath,
  publishedFolderSlugs,
  lucideIconRoot = defaultLucideIconRoot(),
}: ExplorerFolderIconLoadOptions): ExplorerFolderIconLoadResult {
  const warnings = new Set<string>()
  const resolvedContentRoot = path.resolve(contentRoot)

  let realContentRoot: string
  try {
    realContentRoot = realpathSync(resolvedContentRoot)
  } catch {
    return {
      icons: {},
      warnings: [`Content root was not found: ${resolvedContentRoot}`],
    }
  }

  const dataFile = resolveInside(resolvedContentRoot, dataPath)
  if (!dataFile) {
    return {
      icons: {},
      warnings: [`Icon Folder data path escapes the content root: ${dataPath}`],
    }
  }

  const realDataFile = existingRealPathInside(realContentRoot, dataFile)
  if (!realDataFile) {
    return {
      icons: {},
      warnings: [`Icon Folder data was not found: ${dataFile}`],
    }
  }

  let data: unknown
  try {
    data = JSON.parse(readFileSync(realDataFile, "utf8"))
  } catch {
    return {
      icons: {},
      warnings: [`Icon Folder data is invalid JSON: ${realDataFile}`],
    }
  }

  if (!isJsonObject(data)) {
    return {
      icons: {},
      warnings: [`Icon Folder data must be a JSON object: ${realDataFile}`],
    }
  }

  const settings = isJsonObject(data.settings) ? data.settings : {}
  const iconPacksPath =
    typeof settings.iconPacksPath === "string" ? settings.iconPacksPath : ".obsidian/icons"
  const assignments = new Map<string, { sourcePath: string; iconValue: string }>()
  const ambiguousSlugs = new Set<string>()

  for (const [sourcePath, iconValue] of Object.entries(data)) {
    if (sourcePath === "settings" || typeof iconValue !== "string" || iconValue.length === 0) {
      continue
    }

    const directoryPath = resolveInside(resolvedContentRoot, sourcePath)
    if (!directoryPath) {
      warnings.add(`Directory icon path escapes the content root: ${sourcePath}`)
      continue
    }

    const realDirectoryPath = existingRealPathInside(realContentRoot, directoryPath)
    if (!realDirectoryPath) continue

    try {
      if (!statSync(realDirectoryPath).isDirectory()) continue
    } catch {
      continue
    }

    const slug = `${slugifyFilePath(sourcePath.replace(/\\/g, "/") as FilePath)}/index`
    if (!publishedFolderSlugs.has(slug) || ambiguousSlugs.has(slug)) continue

    const existing = assignments.get(slug)
    if (existing) {
      assignments.delete(slug)
      ambiguousSlugs.add(slug)
      warnings.add(
        `Multiple Icon Folder paths normalize to "${slug}": "${existing.sourcePath}" and "${sourcePath}"; omitting the icon`,
      )
      continue
    }

    assignments.set(slug, { sourcePath, iconValue })
  }

  const resolvedIcons: Array<[string, ExplorerFolderIcon]> = []
  for (const [slug, assignment] of assignments) {
    const icon = resolveIcon(
      assignment.iconValue,
      resolvedContentRoot,
      realContentRoot,
      iconPacksPath,
      lucideIconRoot,
      warnings,
    )
    if (icon) resolvedIcons.push([slug, icon])
  }

  resolvedIcons.sort(([left], [right]) => left.localeCompare(right))
  return {
    icons: Object.fromEntries(resolvedIcons),
    warnings: [...warnings],
  }
}
