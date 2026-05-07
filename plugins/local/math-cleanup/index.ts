import type { QuartzTransformerPlugin } from "@quartz-community/types"

const unsupportedMathCharacterRegex = /[\u2061\u2009]/g

function normalizeMathSegment(segment: string): string {
  return segment.replace(unsupportedMathCharacterRegex, (character) => {
    if (character === "\u2061") return ""
    if (character === "\u2009") return "\\,"
    return character
  })
}

function findClosingDelimiter(src: string, start: number, delimiter: "$" | "$$"): number {
  for (let index = start; index < src.length; index++) {
    if (delimiter === "$" && (src[index] === "\n" || src[index] === "\r")) return -1

    if (src[index] === "\\") {
      index++
      continue
    }

    if (delimiter === "$$" && src.startsWith("$$", index)) return index
    if (delimiter === "$" && src[index] === "$" && !src.startsWith("$$", index)) return index
  }

  return -1
}

export function normalizeUnsupportedMathCharacters(src: string): string {
  let output = ""
  let index = 0

  while (index < src.length) {
    if (src[index] === "\\") {
      output += src.slice(index, index + 2)
      index += 2
      continue
    }

    if (src[index] !== "$") {
      output += src[index]
      index++
      continue
    }

    const delimiter: "$" | "$$" = src.startsWith("$$", index) ? "$$" : "$"
    const contentStart = index + delimiter.length
    const contentEnd = findClosingDelimiter(src, contentStart, delimiter)

    if (contentEnd === -1) {
      output += src[index]
      index++
      continue
    }

    output += delimiter
    output += normalizeMathSegment(src.slice(contentStart, contentEnd))
    output += delimiter
    index = contentEnd + delimiter.length
  }

  return output
}

export const MathCleanup: QuartzTransformerPlugin = () => ({
  name: "MathCleanup",
  textTransform(_ctx, src) {
    return normalizeUnsupportedMathCharacters(src)
  },
})

export default MathCleanup
