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
  await fs.promises.mkdir(path.dirname(headersPath), { recursive: true })
  await fs.promises.writeFile(headersPath, content)
}

export const write = async ({ ctx, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  await fs.promises.mkdir(dir, { recursive: true })
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
