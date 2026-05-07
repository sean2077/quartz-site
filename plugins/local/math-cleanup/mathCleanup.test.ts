import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { normalizeUnsupportedMathCharacters } from "./index"

describe("math cleanup", () => {
  test("normalizes unsupported characters inside inline math", () => {
    assert.equal(
      normalizeUnsupportedMathCharacters("Use $O(nlog⁡n)$ and $n - 1$."),
      "Use $O(nlogn)$ and $n\\,-\\,1$.",
    )
  })

  test("normalizes unsupported characters inside block math", () => {
    assert.equal(normalizeUnsupportedMathCharacters("$$a = b$$"), "$$a\\,=\\,b$$")
  })

  test("does not rewrite unsupported characters outside math", () => {
    assert.equal(normalizeUnsupportedMathCharacters("A B and C⁡D"), "A B and C⁡D")
  })

  test("ignores escaped dollar signs", () => {
    assert.equal(normalizeUnsupportedMathCharacters("\\$n - 1$"), "\\$n - 1$")
  })

  test("does not let unmatched inline delimiters consume later lines", () => {
    assert.equal(
      normalizeUnsupportedMathCharacters("cost is $5\nUse $n - 1$ here."),
      "cost is $5\nUse $n\\,-\\,1$ here.",
    )
  })
})
