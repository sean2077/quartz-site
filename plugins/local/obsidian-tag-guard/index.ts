import type { QuartzTransformerPlugin } from "@quartz-community/types"

type Fence = {
  marker: "`" | "~"
  length: number
}

function countRun(src: string, index: number, character: string): number {
  let end = index
  while (src[end] === character) end++
  return end - index
}

function isEscaped(src: string, index: number): boolean {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && src[cursor] === "\\"; cursor--) {
    backslashes++
  }
  return backslashes % 2 === 1
}

function lineStart(src: string, index: number): number {
  const newline = src.lastIndexOf("\n", index - 1)
  const carriageReturn = src.lastIndexOf("\r", index - 1)
  return Math.max(newline, carriageReturn) + 1
}

function lineEnd(src: string, index: number): number {
  const newline = src.indexOf("\n", index)
  return newline === -1 ? src.length : newline + 1
}

function fenceAt(src: string, index: number): Fence | null {
  const marker = src[index]
  if (marker !== "`" && marker !== "~") return null

  const indent = src.slice(lineStart(src, index), index)
  if (!/^ {0,3}$/.test(indent)) return null

  const length = countRun(src, index, marker)
  if (length < 3) return null
  return { marker, length }
}

function isClosingFenceLine(src: string, start: number, fence: Fence): boolean {
  let cursor = start
  let spaces = 0
  while (src[cursor] === " " && spaces < 4) {
    cursor++
    spaces++
  }
  if (spaces > 3) return false

  const markerLength = countRun(src, cursor, fence.marker)
  if (markerLength < fence.length) return false
  cursor += markerLength

  const end = lineEnd(src, cursor)
  const remainder = src.slice(cursor, end).replace(/[\r\n]+$/, "")
  return /^[ \t]*$/.test(remainder)
}

function fencedBlockEnd(src: string, openingIndex: number, fence: Fence): number {
  let cursor = lineEnd(src, openingIndex)
  while (cursor < src.length) {
    if (isClosingFenceLine(src, cursor, fence)) return lineEnd(src, cursor)
    cursor = lineEnd(src, cursor)
  }
  return src.length
}

function inlineCodeEnd(src: string, openingIndex: number, delimiterLength: number): number {
  let cursor = openingIndex + delimiterLength
  while (cursor < src.length) {
    const next = src.indexOf("`", cursor)
    if (next === -1) return -1
    if (isEscaped(src, next)) {
      cursor = next + 1
      continue
    }

    const runLength = countRun(src, next, "`")
    if (runLength === delimiterLength) return next + runLength
    cursor = next + runLength
  }
  return -1
}

function isTagBoundary(character: string | undefined): boolean {
  return character === undefined || character === "#" || " \t\r\n".includes(character)
}

/**
 * Work around remark-obsidian treating ASCII `*` and `#` as emoji tag characters.
 * Numeric issue references at the end of emphasis (for example `**Issue #123**`)
 * otherwise become synthetic tags such as `123**`, which cannot be emitted on Windows.
 */
export function escapeNumericHashtagsBeforeMarkdownClosers(src: string): string {
  let output = ""
  let index = 0

  while (index < src.length) {
    const fence = fenceAt(src, index)
    if (fence !== null) {
      const end = fencedBlockEnd(src, index, fence)
      output += src.slice(index, end)
      index = end
      continue
    }

    if (src[index] === "`" && !isEscaped(src, index)) {
      const delimiterLength = countRun(src, index, "`")
      const end = inlineCodeEnd(src, index, delimiterLength)
      if (end !== -1) {
        output += src.slice(index, end)
        index = end
        continue
      }
    }

    if (src[index] === "#" && !isEscaped(src, index) && isTagBoundary(src[index - 1])) {
      let digitEnd = index + 1
      while (digitEnd < src.length && /[0-9]/.test(src[digitEnd])) digitEnd++
      if (digitEnd > index + 1 && (src[digitEnd] === "*" || src[digitEnd] === "#")) {
        output += "\\#"
        index++
        continue
      }
    }

    output += src[index]
    index++
  }

  return output
}

export const ObsidianTagGuard: QuartzTransformerPlugin = () => ({
  name: "ObsidianTagGuard",
  textTransform(_ctx, src) {
    return escapeNumericHashtagsBeforeMarkdownClosers(src)
  },
})

export default ObsidianTagGuard
