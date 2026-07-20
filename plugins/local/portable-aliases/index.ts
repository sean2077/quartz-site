import type { Root } from "mdast"
import type { QuartzTransformerPlugin, FullSlug } from "@quartz-community/types"
import { slugifyFilePath } from "@quartz-community/utils"
import path from "node:path"
import type { VFile } from "vfile"

const windowsForbiddenCharacters = /[<>:"\\|?*\u0000-\u001f]/u
const windowsReservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu

function isPortablePathSegment(segment: string): boolean {
  if (segment === "." || segment === "..") return true
  if (segment.length === 0 || windowsForbiddenCharacters.test(segment)) return false
  if (segment.endsWith(".") || segment.endsWith(" ")) return false
  return !windowsReservedName.test(segment)
}

export function isPortableAliasSlug(alias: string): boolean {
  return alias.replaceAll("\\", "/").split("/").every(isPortablePathSegment)
}

export function partitionPortableAliasSlugs(aliases: readonly string[]): {
  portable: FullSlug[]
  rejected: string[]
} {
  const portable: FullSlug[] = []
  const rejected: string[] = []

  for (const alias of aliases) {
    if (isPortableAliasSlug(alias)) {
      portable.push(alias.replaceAll("\\", "/") as FullSlug)
    } else {
      rejected.push(alias)
    }
  }

  return { portable, rejected }
}

export function resolvePortableAliasSlug(alias: FullSlug, canonicalSlug: FullSlug): FullSlug {
  if (!/^\.{1,2}/u.test(alias)) return alias

  return path.posix
    .normalize(path.posix.join(path.posix.dirname(canonicalSlug), alias))
    .replace(/^\.\//u, "") as FullSlug
}

export const PortableAliases: QuartzTransformerPlugin = () => ({
  name: "PortableAliases",
  markdownPlugins(ctx) {
    return [
      () => (_tree: Root, file: VFile) => {
        const aliases = file.data.aliases
        if (!Array.isArray(aliases)) return

        const stringAliases = aliases.filter((alias): alias is string => typeof alias === "string")
        const { portable, rejected } = partitionPortableAliasSlugs(stringAliases)
        const canonicalSlug = file.data.slug as FullSlug | undefined
        const resolved = canonicalSlug
          ? portable.map((alias) => resolvePortableAliasSlug(alias, canonicalSlug))
          : portable

        file.data.aliases = resolved

        const canonicalSlugs = new Set(ctx.allFiles.map((filePath) => slugifyFilePath(filePath)))
        const replacedAliases = new Set(
          portable.filter(
            (alias, index) => alias !== resolved[index] && !canonicalSlugs.has(alias),
          ),
        )
        const removedAliases = new Set([...rejected, ...replacedAliases])
        const remainingSlugs = ctx.allSlugs.filter((slug) => !removedAliases.has(slug))
        ctx.allSlugs.splice(0, ctx.allSlugs.length, ...new Set([...remainingSlugs, ...resolved]))

        if (rejected.length > 0) {
          const source = file.data.relativePath ?? file.path
          console.warn(
            `Warning: skipping non-portable alias redirect(s) in ${source}: ${rejected.join(", ")}`,
          )
        }
      },
    ]
  },
})

export default PortableAliases
