import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { firstValidDate, normalizeDateValue } from "./index"

describe("created-modified-date helpers", () => {
  test("ignores missing, null, and invalid frontmatter dates", () => {
    assert.equal(normalizeDateValue(undefined), undefined)
    assert.equal(normalizeDateValue(null), undefined)
    assert.equal(normalizeDateValue("null"), undefined)
    assert.equal(normalizeDateValue("2026-03-20 16:00 - AI 工具 - AI - 工具"), undefined)
  })

  test("accepts valid date values", () => {
    assert.equal(normalizeDateValue("2026-03-20")?.getFullYear(), 2026)
    assert.equal(normalizeDateValue(1_700_000_000_000)?.getFullYear(), 2023)
  })

  test("falls through invalid candidates to the next valid date", () => {
    const fallback = new Date("2026-05-07T00:00:00Z")
    const invalid = firstValidDate(undefined, "not a date")
    assert.equal(firstValidDate(invalid, fallback)?.getTime(), fallback.getTime())
  })
})
