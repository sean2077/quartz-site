import fs from "fs"
import { Repository } from "@napi-rs/simple-git"
import type { Root } from "mdast"
import path from "path"
import type { VFile } from "vfile"
import type { QuartzTransformerPlugin } from "@quartz-community/types"

type DateSource = "frontmatter" | "git" | "filesystem"
type DateType = "created" | "modified" | "published"
type MaybeDate = undefined | string | number | Date | null

export interface CreatedModifiedDateOptions {
  priority: DateSource[]
  defaultDateType: DateType
}

const defaultOptions: CreatedModifiedDateOptions = {
  priority: ["frontmatter", "git", "filesystem"],
  defaultDateType: "modified",
}

const iso8601DateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/

export function normalizeDateValue(value: MaybeDate): Date | undefined {
  if (value === undefined || value === null) return undefined

  let candidate = value
  if (typeof candidate === "string") {
    const trimmed = candidate.trim()
    if (trimmed === "" || trimmed.toLowerCase() === "null") return undefined
    candidate = iso8601DateOnlyRegex.test(trimmed) ? `${trimmed}T00:00:00` : trimmed
  }

  const date = new Date(candidate)
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return undefined
  return date
}

export function firstValidDate(current: Date | undefined, candidate: MaybeDate): Date | undefined {
  return current ?? normalizeDateValue(candidate)
}

type FrontmatterDates = Partial<Record<DateType, MaybeDate>>

type FileData = {
  relativePath?: string
  filePath?: string
  frontmatter?: FrontmatterDates
  dates?: Record<DateType, Date>
  defaultDateType?: DateType
}

function fallbackDate(...dates: Array<Date | undefined>): Date {
  return dates.find((date): date is Date => date !== undefined) ?? new Date()
}

export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<CreatedModifiedDateOptions>> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          let repo: Repository | undefined
          let repositoryWorkdir = path.resolve(ctx.argv.directory)

          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory)
              repositoryWorkdir = repo.workdir() ?? repositoryWorkdir
            } catch {
              repo = undefined
            }
          }

          return async (_tree: Root, file: VFile) => {
            let created: Date | undefined
            let modified: Date | undefined
            let published: Date | undefined

            const data = file.data as FileData
            const fullPath = data.filePath ? path.resolve(data.filePath) : file.path

            for (const source of opts.priority) {
              if (source === "filesystem") {
                const stats = await fs.promises.stat(fullPath)
                created = firstValidDate(created, stats.birthtimeMs)
                modified = firstValidDate(modified, stats.mtimeMs)
              } else if (source === "frontmatter" && data.frontmatter) {
                created = firstValidDate(created, data.frontmatter.created)
                modified = firstValidDate(modified, data.frontmatter.modified)
                published = firstValidDate(published, data.frontmatter.published)
              } else if (source === "git" && repo) {
                try {
                  const relativePath = path.relative(repositoryWorkdir, fullPath)
                  modified = firstValidDate(
                    modified,
                    await repo.getFileLatestModifiedDateAsync(relativePath),
                  )
                } catch {
                  // Untracked content is expected in this vault; later sources provide a stable fallback.
                }
              }
            }

            const fallback = fallbackDate(modified, created)
            data.dates = {
              created: fallbackDate(created, fallback),
              modified: fallbackDate(modified, fallback),
              published: fallbackDate(published, fallback),
            }
            data.defaultDateType = opts.defaultDateType
          }
        },
      ]
    },
  }
}

export default CreatedModifiedDate
