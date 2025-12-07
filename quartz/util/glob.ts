import path from "path"
import { FilePath } from "./path"
import { globby } from "globby"
import fs from "fs"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
): Promise<FilePath[]> {
  // Read the notebook repository's .gitignore (if it exists)
  // This prevents globby from searching up the directory tree and reading
  // the project root's .gitignore which may exclude the notebook directory
  const localGitignorePath = path.join(cwd, ".gitignore")
  let localGitignorePatterns: string[] = []

  if (fs.existsSync(localGitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(localGitignorePath, "utf-8")
      localGitignorePatterns = gitignoreContent
        .split("\n")
        .map((line) => line.trim())
        // Filter out empty lines, comments, and negation patterns
        .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    } catch (err) {
      console.warn(`Warning: Failed to read .gitignore at ${localGitignorePath}`)
    }
  }

  const fps = (
    await globby(pattern, {
      cwd,
      ignore: [...ignorePatterns, ...localGitignorePatterns],
      gitignore: false, // Disable automatic search to avoid reading parent directories
    })
  ).map(toPosixPath)
  return fps as FilePath[]
}
