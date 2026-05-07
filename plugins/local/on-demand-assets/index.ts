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

      for (const changeEvent of changeEvents) {
        const ext = path.extname(changeEvent.path)
        if (ext === ".md") continue

        if (changeEvent.type === "add" || changeEvent.type === "change") {
          const isReferenced =
            referencedAssets.has(changeEvent.path) ||
            referencedAssets.has(path.basename(changeEvent.path))

          if (isReferenced) {
            yield copyFile(ctx.argv, changeEvent.path)
          }
        } else if (changeEvent.type === "delete") {
          const name = slugifyFilePath(changeEvent.path)
          const dest = joinSegments(ctx.argv.output, name) as FilePath
          try {
            await fs.promises.unlink(dest)
          } catch {}
        }
      }
    },
  }
}

export default OnDemandAssets
