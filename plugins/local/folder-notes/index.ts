import path from "node:path"
import type { Root } from "hast"
import type { QuartzTransformerPlugin } from "@quartz-community/types"

export function isFolderNotePath(filePath: string): boolean {
  const ext = path.extname(filePath)
  const withoutExt = ext ? filePath.slice(0, -ext.length) : filePath
  const fileName = path.posix.basename(withoutExt)
  const folderName = path.posix.basename(path.posix.dirname(withoutExt))
  return fileName.length > 0 && fileName === folderName
}

export function getFolderFromFolderNotePath(filePath: string): string {
  const ext = path.extname(filePath)
  const withoutExt = ext ? filePath.slice(0, -ext.length) : filePath
  return path.posix.dirname(withoutExt)
}

export const FolderNotes: QuartzTransformerPlugin = () => ({
  name: "FolderNotes",
  htmlPlugins() {
    return [
      () => {
        return (_tree: Root, file) => {
          const relativePath = String(file.data.relativePath ?? "")
          if (!isFolderNotePath(relativePath)) return

          file.data.isFolderNote = true
          file.data.folderNotePath = getFolderFromFolderNotePath(relativePath)
        }
      },
    ]
  },
})

export default FolderNotes
