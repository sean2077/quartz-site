import { QuartzPluginData } from "../../plugins/vfile"
import { FilterExpression, FilterFn, BaseConfig, SortConfig, PropertyValue } from "./types"

/**
 * Parse a filter expression and return a filter function
 * @param expression - The filter expression to parse
 * @param currentFile - The file containing the base block (for this.file references)
 */
export function parseFilter(
  expression: FilterExpression,
  currentFile?: QuartzPluginData,
): FilterFn {
  // Handle nested logical structures
  if (typeof expression === "object") {
    if ("and" in expression) {
      const subFilters = expression.and.map((e) => parseFilter(e, currentFile))
      return (file, allFiles, cf) =>
        subFilters.every((fn) => fn(file, allFiles, cf ?? currentFile))
    }
    if ("or" in expression) {
      const subFilters = expression.or.map((e) => parseFilter(e, currentFile))
      return (file, allFiles, cf) =>
        subFilters.some((fn) => fn(file, allFiles, cf ?? currentFile))
    }
    if ("not" in expression) {
      const subFilter = parseFilter(expression.not, currentFile)
      return (file, allFiles, cf) => !subFilter(file, allFiles, cf ?? currentFile)
    }
  }

  // Handle string filter expressions
  if (typeof expression === "string") {
    return parseFilterString(expression, currentFile)
  }

  // Default: accept all
  return () => true
}

/**
 * Get the folder path from a file's slug
 */
function getFileFolder(file: QuartzPluginData): string {
  const slug = file.slug ?? ""
  const lastSlash = slug.lastIndexOf("/")
  return lastSlash > 0 ? slug.substring(0, lastSlash) : ""
}

/**
 * Parse a string filter expression like "file.hasTag('book')" or "status == 'done'"
 * @param expr - The filter expression string
 * @param currentFile - The file containing the base block (for this.file references)
 */
function parseFilterString(expr: string, currentFile?: QuartzPluginData): FilterFn {
  const trimmed = expr.trim()

  // Resolve this.file.* references by replacing them with actual values
  if (trimmed.includes("this.file.")) {
    let resolved = trimmed

    // this.file.folder - current file's folder path
    if (resolved.includes("this.file.folder")) {
      const folder = currentFile ? getFileFolder(currentFile) : ""
      resolved = resolved.replace(/this\.file\.folder/g, `"${folder}"`)
    }

    // this.file.name - current file's name/title
    if (resolved.includes("this.file.name")) {
      const name = currentFile?.frontmatter?.title ?? currentFile?.slug?.split("/").pop() ?? ""
      resolved = resolved.replace(/this\.file\.name/g, `"${name}"`)
    }

    // this.file.path - current file's full path
    if (resolved.includes("this.file.path")) {
      const path = currentFile?.slug ?? ""
      resolved = resolved.replace(/this\.file\.path/g, `"${path}"`)
    }

    // If we made replacements, re-parse with resolved values
    if (resolved !== trimmed) {
      return parseFilterString(resolved, currentFile)
    }
  }

  // 1. Negation prefix: !expression
  if (trimmed.startsWith("!")) {
    const innerFn = parseFilterString(trimmed.slice(1), currentFile)
    return (file, allFiles, cf) => !innerFn(file, allFiles, cf)
  }

  // file.hasTag("tag")
  const hasTagMatch = trimmed.match(/^file\.hasTag\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (hasTagMatch) {
    const tag = hasTagMatch[1]
    return (file) => {
      const tags = file.frontmatter?.tags ?? []
      return tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    }
  }

  // file.tags.contains("tag") - Obsidian Bases native syntax
  const tagsContainsMatch = trimmed.match(/^file\.tags\.contains\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (tagsContainsMatch) {
    const tag = tagsContainsMatch[1]
    return (file) => {
      const tags = file.frontmatter?.tags ?? []
      return tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    }
  }

  // file.inFolder("path")
  const inFolderMatch = trimmed.match(/^file\.inFolder\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (inFolderMatch) {
    const folder = inFolderMatch[1]
    return (file) => {
      const slug = file.slug ?? ""
      return slug.startsWith(folder) || slug.includes(`/${folder}/`)
    }
  }

  // file.name.contains("str") / file.name.startsWith("str") / file.name.endsWith("str")
  const fileNameMethodMatch = trimmed.match(
    /^file\.name\.(contains|startsWith|endsWith)\s*\(\s*["']([^"']+)["']\s*\)$/,
  )
  if (fileNameMethodMatch) {
    const [, method, value] = fileNameMethodMatch
    return (file) => {
      const name = (file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "").toLowerCase()
      const v = value.toLowerCase()
      if (method === "contains") return name.includes(v)
      if (method === "startsWith") return name.startsWith(v)
      if (method === "endsWith") return name.endsWith(v)
      return false
    }
  }

  // file.name.lower().contains("str") - chained call with lower()
  const fileNameLowerMethodMatch = trimmed.match(
    /^file\.name\.lower\(\)\.(contains|startsWith|endsWith)\s*\(\s*["']([^"']+)["']\s*\)$/,
  )
  if (fileNameLowerMethodMatch) {
    const [, method, value] = fileNameLowerMethodMatch
    return (file) => {
      const name = (file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "").toLowerCase()
      const v = value.toLowerCase()
      if (method === "contains") return name.includes(v)
      if (method === "startsWith") return name.startsWith(v)
      if (method === "endsWith") return name.endsWith(v)
      return false
    }
  }

  // file.hasLink("note")
  const hasLinkMatch = trimmed.match(/^file\.hasLink\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (hasLinkMatch) {
    const linkTarget = hasLinkMatch[1].toLowerCase()
    return (file) => {
      const links = file.links ?? []
      return links.some((link) => {
        // link is SimpleSlug, convert to string for comparison
        return String(link).toLowerCase().includes(linkTarget)
      })
    }
  }

  // property.contains("value") / property.startsWith("value") / property.endsWith("value")
  // Also handles arrays: checks if any element matches
  const propMethodMatch = trimmed.match(
    /^([\w.]+)\.(contains|startsWith|endsWith)\s*\(\s*["']([^"']+)["']\s*\)$/,
  )
  if (propMethodMatch) {
    const [, propPath, method, value] = propMethodMatch
    // Skip file.name.* and file.tags.* which are handled separately
    if (!propPath.startsWith("file.")) {
      return (file) => {
        const propValue = getPropertyValue(file, propPath)
        if (propValue === null || propValue === undefined) return false

        const v = value.toLowerCase()

        // Handle arrays: check if any element matches
        if (Array.isArray(propValue)) {
          return propValue.some((item) => {
            const itemStr = String(item).toLowerCase()
            if (method === "contains") return itemStr.includes(v)
            if (method === "startsWith") return itemStr.startsWith(v)
            if (method === "endsWith") return itemStr.endsWith(v)
            return false
          })
        }

        // Handle strings
        const strValue = String(propValue).toLowerCase()
        if (method === "contains") return strValue.includes(v)
        if (method === "startsWith") return strValue.startsWith(v)
        if (method === "endsWith") return strValue.endsWith(v)
        return false
      }
    }
  }

  // property.isEmpty() - check if property is empty/null/undefined
  const isEmptyMatch = trimmed.match(/^([\w.]+)\.isEmpty\s*\(\s*\)$/)
  if (isEmptyMatch) {
    const propPath = isEmptyMatch[1]
    return (file) => {
      const value = getPropertyValue(file, propPath)
      if (value === null || value === undefined) return true
      if (Array.isArray(value)) return value.length === 0
      if (typeof value === "string") return value.trim() === ""
      return false
    }
  }

  // Property comparisons: property == value, property != value, etc.
  const comparisonMatch = trimmed.match(/^([\w.]+)\s*(==|!=|>=|<=|>|<)\s*["']?([^"']+)["']?$/)
  if (comparisonMatch) {
    const [, propPath, operator, valueStr] = comparisonMatch
    return (file) => {
      const propValue = getPropertyValue(file, propPath)
      const compareValue = parseValue(valueStr)
      return compareValues(propValue, operator, compareValue)
    }
  }

  // Function-style aliases: taggedWith(file.file, "tag")
  const taggedWithMatch = trimmed.match(/^taggedWith\s*\(\s*file\.file\s*,\s*["']([^"']+)["']\s*\)$/)
  if (taggedWithMatch) {
    const tag = taggedWithMatch[1]
    return (file) => {
      const tags = file.frontmatter?.tags ?? []
      return tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    }
  }

  // linksTo(file.file, "target") or linksTo(file.file, this.file.path)
  const linksToMatch = trimmed.match(/^linksTo\s*\(\s*file\.file\s*,\s*["']([^"']+)["']\s*\)$/)
  if (linksToMatch) {
    const target = linksToMatch[1].toLowerCase()
    return (file) => {
      const links = file.links ?? []
      return links.some((link) => String(link).toLowerCase().includes(target))
    }
  }

  // inFolder(file.file, "folder")
  const inFolderFuncMatch = trimmed.match(
    /^inFolder\s*\(\s*file\.file\s*,\s*["']([^"']+)["']\s*\)$/,
  )
  if (inFolderFuncMatch) {
    const folder = inFolderFuncMatch[1]
    return (file) => {
      const slug = file.slug ?? ""
      return slug.startsWith(folder) || slug.includes(`/${folder}/`)
    }
  }

  // Simple property check (truthy)
  if (/^[\w.]+$/.test(trimmed)) {
    return (file) => {
      const value = getPropertyValue(file, trimmed)
      return Boolean(value)
    }
  }

  console.warn(`[ObsidianBases] Unknown filter expression: ${expr}`)
  return () => true
}

/**
 * Get a property value from a file
 * Supports: file.name, file.path, file.ctime, file.mtime, file.size
 * And frontmatter properties: property or note.property
 */
export function getPropertyValue(file: QuartzPluginData, propPath: string): PropertyValue {
  const parts = propPath.split(".")

  // File properties
  if (parts[0] === "file") {
    const fileProp = parts[1]
    switch (fileProp) {
      case "name":
        return file.frontmatter?.title ?? file.slug?.split("/").pop() ?? ""
      case "path":
        return file.filePath ?? ""
      case "slug":
        return file.slug ?? ""
      case "ctime":
      case "created":
        return file.dates?.created ?? null
      case "mtime":
      case "modified":
        return file.dates?.modified ?? null
      case "size":
        return null // Not available in QuartzPluginData
      case "ext":
        return "md"
      case "folder":
        const slug = file.slug ?? ""
        const lastSlash = slug.lastIndexOf("/")
        return lastSlash > 0 ? slug.substring(0, lastSlash) : ""
      default:
        return null
    }
  }

  // Frontmatter properties: note.property or just property
  const propName = parts[0] === "note" ? parts.slice(1).join(".") : propPath
  const frontmatter = file.frontmatter as Record<string, unknown> | undefined

  if (!frontmatter) return null

  // Handle nested properties
  const propParts = propName.split(".")
  let value: unknown = frontmatter

  for (const part of propParts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part]
    } else {
      return null
    }
  }

  // Convert date strings to Date objects for proper sorting
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  return value as PropertyValue
}

/**
 * Parse a string value to its appropriate type
 */
function parseValue(str: string): PropertyValue {
  const trimmed = str.trim()

  // Boolean
  if (trimmed === "true") return true
  if (trimmed === "false") return false

  // Number
  const num = Number(trimmed)
  if (!isNaN(num)) return num

  // String
  return trimmed
}

/**
 * Compare two values using the specified operator
 */
function compareValues(a: PropertyValue, operator: string, b: PropertyValue): boolean {
  // Handle null/undefined
  if (a === null || a === undefined) {
    if (operator === "==" || operator === "===") return b === null || b === undefined
    if (operator === "!=" || operator === "!==") return b !== null && b !== undefined
    return false
  }

  // Convert to comparable types
  const aStr = String(a).toLowerCase()
  const bStr = String(b).toLowerCase()

  switch (operator) {
    case "==":
    case "===":
      return aStr === bStr
    case "!=":
    case "!==":
      return aStr !== bStr
    case ">":
      return typeof a === "number" && typeof b === "number" ? a > b : aStr > bStr
    case "<":
      return typeof a === "number" && typeof b === "number" ? a < b : aStr < bStr
    case ">=":
      return typeof a === "number" && typeof b === "number" ? a >= b : aStr >= bStr
    case "<=":
      return typeof a === "number" && typeof b === "number" ? a <= b : aStr <= bStr
    default:
      return false
  }
}

/**
 * Sort files by specified configuration
 */
export function sortFiles(files: QuartzPluginData[], sortConfig: SortConfig[]): QuartzPluginData[] {
  return [...files].sort((a, b) => {
    for (const { property, direction } of sortConfig) {
      const aVal = getPropertyValue(a, property)
      const bVal = getPropertyValue(b, property)
      const dir = direction.toLowerCase() === "desc" ? -1 : 1

      if (aVal === bVal) continue

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return dir
      if (bVal === null || bVal === undefined) return -dir

      // Compare dates
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * dir
      }

      // Compare numbers
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir
      }

      // Compare strings
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr < bStr) return -dir
      if (aStr > bStr) return dir
    }
    return 0
  })
}

/**
 * Execute a query against all files
 * @param allFiles - All available files to query
 * @param config - Base configuration with filters, views, etc.
 * @param maxResults - Maximum number of results to return
 * @param currentFile - The file containing the base block (for this.file references)
 */
export function executeQuery(
  allFiles: QuartzPluginData[],
  config: BaseConfig,
  maxResults: number = 100,
  currentFile?: QuartzPluginData,
): QuartzPluginData[] {
  let files = [...allFiles]

  // Apply global filters (top-level)
  if (config.filters) {
    const filterFn = parseFilter(config.filters, currentFile)
    files = files.filter((f) => filterFn(f, allFiles, currentFile))
  }

  // Apply first view's config
  const firstView = config.views?.[0]

  // Apply view-level filters (Obsidian puts filters inside views)
  if (firstView?.filters) {
    const viewFilterFn = parseFilter(firstView.filters, currentFile)
    files = files.filter((f) => viewFilterFn(f, allFiles, currentFile))
  }

  // Apply sort
  if (firstView?.sort) {
    files = sortFiles(files, firstView.sort)
  } else {
    // Default sort: by title
    files = sortFiles(files, [{ property: "file.name", direction: "asc" }])
  }

  // Apply limit
  const limit = firstView?.limit ?? maxResults
  if (limit > 0) {
    files = files.slice(0, limit)
  }

  return files
}
