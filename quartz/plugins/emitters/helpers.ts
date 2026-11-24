import path from "path"
import fs from "fs"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { Readable } from "stream"

type WriteOptions = {
  ctx: BuildCtx
  slug: FullSlug
  ext: `.${string}` | ""
  content: string | Buffer | Readable
}

// A new BuildCtx starts each full rebuild, after output has been cleaned. Cache
// in-flight mkdir promises per build so concurrent emitters share the work without
// retaining stale directories across rebuilds in the same process.
const ensuredDirs = new WeakMap<BuildCtx, Map<string, Promise<string | undefined>>>()

function ensureDirectory(ctx: BuildCtx, dir: string): Promise<string | undefined> {
  let directories = ensuredDirs.get(ctx)
  if (!directories) {
    directories = new Map()
    ensuredDirs.set(ctx, directories)
  }

  let ensured = directories.get(dir)
  if (!ensured) {
    ensured = fs.promises.mkdir(dir, { recursive: true }).catch((error) => {
      directories.delete(dir)
      throw error
    })
    directories.set(dir, ensured)
  }
  return ensured
}

const cloudflareHtmlAliasHeaderPath = "/*/index"
const cloudflareHtmlAliasHeaderValue = "Content-Type: text/html; charset=utf-8"
const cloudflareHtmlAliasHeaders = `${cloudflareHtmlAliasHeaderPath}
  ${cloudflareHtmlAliasHeaderValue}
`

export function folderIndexHtmlAlias(slug: FullSlug, ext: `.${string}` | ""): FullSlug | null {
  if (ext !== ".html") return null
  if (!slug.endsWith("/index")) return null
  return slug
}

export function hasCloudflareHtmlAliasHeaders(existing: string): boolean {
  const blocks = existing.split(/\r?\n\s*\r?\n/)
  const headerValue = cloudflareHtmlAliasHeaderValue.toLowerCase()
  return blocks.some((block) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    return (
      lines[0] === cloudflareHtmlAliasHeaderPath &&
      lines.slice(1).some((line) => line.toLowerCase() === headerValue)
    )
  })
}

async function ensureCloudflareHtmlAliasHeaders(ctx: BuildCtx): Promise<void> {
  const headersPath = joinSegments(ctx.argv.output, "_headers") as FilePath
  let existing = ""
  try {
    existing = await fs.promises.readFile(headersPath, "utf-8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }

  if (hasCloudflareHtmlAliasHeaders(existing)) return

  const next = existing.trimEnd()
  const content = next ? `${next}\n\n${cloudflareHtmlAliasHeaders}` : cloudflareHtmlAliasHeaders
  await ensureDirectory(ctx, path.dirname(headersPath))
  await fs.promises.writeFile(headersPath, content)
}

export const write = async ({ ctx, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  await ensureDirectory(ctx, dir)
  await fs.promises.writeFile(pathToPage, content)

  const aliasSlug = folderIndexHtmlAlias(slug, ext)
  if (aliasSlug && !(content instanceof Readable)) {
    // Cloudflare Pages dev can serve trailing-slash folder pages but fails
    // some CJK /folder/index routes unless an extensionless alias exists.
    const aliasPath = joinSegments(ctx.argv.output, aliasSlug) as FilePath
    await fs.promises.writeFile(aliasPath, content)
    await ensureCloudflareHtmlAliasHeaders(ctx)
  }

  return pathToPage
}
