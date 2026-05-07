import test, { describe } from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"

describe("SPA navigation progress", () => {
  test("reuses and completes a single navigation progress element", async () => {
    const source = await readFile(new URL("./spa.inline.ts", import.meta.url), "utf-8")

    assert.match(source, /document\.querySelector\("\.navigation-progress"\)/)
    assert.match(source, /function finishLoading\(\)/)
    assert.match(source, /finishLoading\(\)\s*\n\s*isNavigating = false/)
    assert.doesNotMatch(source, /document\.body\.contains\(loadingBar\)/)
  })
})
