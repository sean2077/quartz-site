import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { escapeNumericHashtagsBeforeMarkdownClosers } from "./index"

describe("ObsidianTagGuard", () => {
  test("protects numeric issue references from emphasis delimiters", () => {
    assert.equal(
      escapeNumericHashtagsBeforeMarkdownClosers("**Godot Issue #80513** and *rank #1*"),
      "**Godot Issue \\#80513** and *rank \\#1*",
    )
  })

  test("protects numeric references from closing hash markers", () => {
    assert.equal(
      escapeNumericHashtagsBeforeMarkdownClosers("## Result #2026##"),
      "## Result \\#2026##",
    )
  })

  test("leaves ordinary references and valid tags unchanged", () => {
    const source = "Issue #80513, #release-1, #2026_roadmap, and #中文"
    assert.equal(escapeNumericHashtagsBeforeMarkdownClosers(source), source)
  })

  test("does not double-escape protected references", () => {
    const source = "**Issue \\#80513**"
    assert.equal(escapeNumericHashtagsBeforeMarkdownClosers(source), source)
  })

  test("does not rewrite inline code", () => {
    const source = "Use `**Issue #80513**` but render **Issue #80513**."
    assert.equal(
      escapeNumericHashtagsBeforeMarkdownClosers(source),
      "Use `**Issue #80513**` but render **Issue \\#80513**.",
    )
  })

  test("does not rewrite backtick or tilde fenced code", () => {
    const source = [
      "```md",
      "**Issue #80513**",
      "```",
      "~~~md",
      "**Rank #1**",
      "~~~",
      "**Rank #1**",
    ].join("\n")
    const expected = [
      "```md",
      "**Issue #80513**",
      "```",
      "~~~md",
      "**Rank #1**",
      "~~~",
      "**Rank \\#1**",
    ].join("\n")
    assert.equal(escapeNumericHashtagsBeforeMarkdownClosers(source), expected)
  })
})
