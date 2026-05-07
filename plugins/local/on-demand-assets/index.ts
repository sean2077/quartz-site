import fs from "node:fs"
import path from "node:path"
import { globby } from "globby"
import type {
  Argv,
  FilePath,
  ProcessedContent,
  QuartzConfig,
  QuartzEmitterPlugin,
} from "@quartz-community/types"
import { joinSegments, slugifyFilePath } from "@quartz-community/utils"

interface Options {
  includeUnresolved?: boolean
  alwaysInclude?: string[]
}

const defaultOptions: Options = {
  includeUnresolved: false,
  alwaysInclude: [],
}

function sluggifySegment(s: string): string {
  return s
    .replace(/\s/g, "-")
    .replace(/&/g, "-and-")
    .replace(/%/g, "-percent")
    .replace(/\?/g, "")
    .replace(/#/g, "")
}

function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

async function glob(pattern: string, cwd: string, ignorePatterns: string[]): Promise<FilePath[]> {
  return (
    await globby(pattern, {
      cwd,
      ignore: ignorePatterns,
      gitignore: true,
    })
  ).map(toPosixPath) as FilePath[]
}

export function collectReferencedAssets(content: ProcessedContent[]): Set<string> {
  const referencedAssets = new Set<string>()

  for (const [_tree, file] of content) {
    const assets = (file.data.assets ?? []) as string[]
    for (const asset of assets) {
      referencedAssets.add(asset)
    }
  }

  return referencedAssets
}

export async function getAllAssets(argv: Argv, cfg: QuartzConfig): Promise<Map<string, FilePath>> {
  const files = await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns])
  const assetMap = new Map<string, FilePath>()

  for (const fp of files) {
    assetMap.set(fp, fp)

    const basename = path.basename(fp)
    if (!assetMap.has(basename)) {
      assetMap.set(basename, fp)
    }

    const slugifiedBasename = sluggifySegment(basename)
    if (slugifiedBasename !== basename && !assetMap.has(slugifiedBasename)) {
      assetMap.set(slugifiedBasename, fp)
    }

    const slugifiedPath = fp
      .split("/")
      .map((seg) => sluggifySegment(seg))
      .join("/")
    if (slugifiedPath !== fp && !assetMap.has(slugifiedPath)) {
      assetMap.set(slugifiedPath, fp)
    }
  }

  return assetMap
}

export function resolveAsset(ref: string, assetMap: Map<string, FilePath>): FilePath | undefined {
  if (assetMap.has(ref)) {
    return assetMap.get(ref)
  }

  const basename = path.basename(ref)
  if (assetMap.has(basename)) {
    return assetMap.get(basename)
  }

  try {
    const decoded = decodeURIComponent(ref)
    if (assetMap.has(decoded)) {
      return assetMap.get(decoded)
    }

    const decodedBasename = path.basename(decoded)
    if (assetMap.has(decodedBasename)) {
      return assetMap.get(decodedBasename)
    }
  } catch {}

  return undefined
}

async function copyFile(argv: Argv, fp: FilePath): Promise<FilePath> {
  const src = joinSegments(argv.directory, fp) as FilePath
  const name = slugifyFilePath(fp)
  const dest = joinSegments(argv.output, name) as FilePath
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.copyFile(src, dest)
  return dest
}

async function removeCopiedFile(argv: Argv, fp: FilePath): Promise<void> {
  const name = slugifyFilePath(fp)
  const dest = joinSegments(argv.output, name) as FilePath
  try {
    await fs.promises.unlink(dest)
  } catch {}
}

export const OnDemandAssets: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "OnDemandAssets",
    async *emit(ctx, content) {
      const { argv, cfg } = ctx
      const assetMap = await getAllAssets(argv, cfg)
      const referencedAssets = collectReferencedAssets(content)
      const copiedAssets = new Set<FilePath>()

      for (const ref of referencedAssets) {
        const resolved = resolveAsset(ref, assetMap)
        if (resolved && !copiedAssets.has(resolved)) {
          copiedAssets.add(resolved)
          yield copyFile(argv, resolved)
        }
      }

      for (const pattern of opts.alwaysInclude ?? []) {
        const files = await glob(pattern, argv.directory, cfg.configuration.ignorePatterns)
        for (const fp of files) {
          if (!copiedAssets.has(fp)) {
            copiedAssets.add(fp)
            yield copyFile(argv, fp)
          }
        }
      }

      const savedCount = assetMap.size - copiedAssets.size
      if (savedCount > 0) {
        console.log(
          `\nOnDemandAssets: Copied ${copiedAssets.size}/${assetMap.size} assets (saved ${savedCount} unused files)`,
        )
      }
    },
    async *partialEmit(ctx, content, _resources, changeEvents) {
      const referencedAssets = collectReferencedAssets(content)
      let assetMap: Map<string, FilePath> | undefined
      const copiedAssets = new Set<FilePath>()
      let retainedAssets: Set<FilePath> | undefined

      const getAssetMap = async () => (assetMap ??= await getAllAssets(ctx.argv, ctx.cfg))

      const resolveReferencedAssets = async (refs: Iterable<string>): Promise<Set<FilePath>> => {
        const map = await getAssetMap()
        const resolvedAssets = new Set<FilePath>()

        for (const ref of refs) {
          const resolved = resolveAsset(ref, map)
          if (resolved) {
            resolvedAssets.add(resolved)
          }
        }

        return resolvedAssets
      }

      const getRetainedAssets = async (): Promise<Set<FilePath>> => {
        if (retainedAssets) return retainedAssets

        retainedAssets = await resolveReferencedAssets(referencedAssets)
        for (const pattern of opts.alwaysInclude ?? []) {
          const files = await glob(
            pattern,
            ctx.argv.directory,
            ctx.cfg.configuration.ignorePatterns,
          )
          for (const fp of files) {
            retainedAssets.add(fp)
          }
        }

        return retainedAssets
      }

      const copyReferencedAssets = async function* (refs: Iterable<string>) {
        const resolvedAssets = await resolveReferencedAssets(refs)
        for (const fp of resolvedAssets) {
          if (!copiedAssets.has(fp)) {
            copiedAssets.add(fp)
            yield copyFile(ctx.argv, fp)
          }
        }
      }

      const removeUnreferencedAssets = async () => {
        const map = await getAssetMap()
        const retained = await getRetainedAssets()
        for (const fp of new Set(map.values())) {
          if (!retained.has(fp)) {
            await removeCopiedFile(ctx.argv, fp)
          }
        }
      }

      let sawMarkdownChange = false

      for (const changeEvent of changeEvents) {
        const ext = path.extname(changeEvent.path)
        if (ext === ".md") {
          sawMarkdownChange = true
          if (changeEvent.type === "add" || changeEvent.type === "change") {
            const changedMarkdownAssets = (changeEvent.file?.data.assets ?? []) as string[]
            yield* copyReferencedAssets(
              changedMarkdownAssets.length > 0 ? changedMarkdownAssets : referencedAssets,
            )
          }
          continue
        }

        if (changeEvent.type === "add" || changeEvent.type === "change") {
          const retained = await getRetainedAssets()
          const isRetained = retained.has(changeEvent.path)

          if (isRetained) {
            yield copyFile(ctx.argv, changeEvent.path)
          } else {
            await removeCopiedFile(ctx.argv, changeEvent.path)
          }
        } else if (changeEvent.type === "delete") {
          await removeCopiedFile(ctx.argv, changeEvent.path)
        }
      }

      if (sawMarkdownChange) {
        await removeUnreferencedAssets()
      }
    },
  }
}

export default OnDemandAssets
