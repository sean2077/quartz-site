import type { ChangeEvent } from "../plugins/types"
import type { FilePath } from "./path"
import type { ProcessedContent } from "../plugins/vfile"
import path from "node:path"

export type ChangeRecord = Record<FilePath, ChangeEvent["type"]>
export type ContentMap = Map<
  FilePath,
  { type: "markdown"; content: ProcessedContent } | { type: "other" }
>

/** Keep the original VFile in delete events before removing it from the live content map. */
export function applyContentChanges(contentMap: ContentMap, changes: ChangeRecord): ChangeEvent[] {
  return Object.entries(changes).map(([filePath, type]) => {
    const file = filePath as FilePath
    if (type === "add" && path.extname(file) !== ".md") {
      contentMap.set(file, { type: "other" })
    }

    const processed = contentMap.get(file)
    const event: ChangeEvent = {
      type,
      path: file,
      ...(processed?.type === "markdown" ? { file: processed.content[1] } : {}),
    }
    if (type === "delete") contentMap.delete(file)
    return event
  })
}

export function clearChangeRecord(changes: ChangeRecord) {
  for (const fp of Object.keys(changes)) {
    delete changes[fp as FilePath]
  }
}
