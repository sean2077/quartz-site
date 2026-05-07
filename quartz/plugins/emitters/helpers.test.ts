import test, { describe } from "node:test"
import assert from "node:assert"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { BuildCtx } from "../../util/ctx"
import { FullSlug } from "../../util/path"
import { folderIndexHtmlAlias, hasCloudflareHtmlAliasHeaders, write } from "./helpers"

describe("folderIndexHtmlAlias", () => {
  test("adds an extensionless alias for nested folder index HTML pages", () => {
    assert.strictEqual(
      folderIndexHtmlAlias("1o-趋势与行业洞察/index" as FullSlug, ".html"),
      "1o-趋势与行业洞察/index",
    )
  })

  test("does not alias the site root index", () => {
    assert.strictEqual(folderIndexHtmlAlias("index" as FullSlug, ".html"), null)
  })

  test("does not alias non-index content pages", () => {
    assert.strictEqual(folderIndexHtmlAlias("1o-趋势与行业洞察/page" as FullSlug, ".html"), null)
  })

  test("does not alias non-HTML outputs", () => {
    assert.strictEqual(folderIndexHtmlAlias("1o-趋势与行业洞察/index" as FullSlug, ".xml"), null)
  })
})

describe("hasCloudflareHtmlAliasHeaders", () => {
  test("recognizes the Cloudflare HTML alias rule in a single block", () => {
    assert(hasCloudflareHtmlAliasHeaders("/*/index\n  Content-Type: text/html; charset=utf-8\n"))
  })

  test("does not match path and content type from separate blocks", () => {
    assert(
      !hasCloudflareHtmlAliasHeaders(
        "/*/index\n  X-Test: true\n\n/other\n  Content-Type: text/html; charset=utf-8\n",
      ),
    )
  })
})

describe("write", () => {
  test("writes folder index HTML aliases and Cloudflare headers", async () => {
    const output = await mkdtemp(join(tmpdir(), "quartz-write-"))
    const ctx = { argv: { output } } as BuildCtx
    const html = "<!doctype html><title>folder</title>"

    try {
      await write({
        ctx,
        slug: "1o-趋势与行业洞察/index" as FullSlug,
        ext: ".html",
        content: html,
      })

      assert.strictEqual(
        await readFile(join(output, "1o-趋势与行业洞察", "index.html"), "utf-8"),
        html,
      )
      assert.strictEqual(await readFile(join(output, "1o-趋势与行业洞察", "index"), "utf-8"), html)
      assert(hasCloudflareHtmlAliasHeaders(await readFile(join(output, "_headers"), "utf-8")))
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  })

  test("does not duplicate Cloudflare headers across repeated folder index writes", async () => {
    const output = await mkdtemp(join(tmpdir(), "quartz-write-"))
    const ctx = { argv: { output } } as BuildCtx

    try {
      await write({
        ctx,
        slug: "1o-趋势与行业洞察/index" as FullSlug,
        ext: ".html",
        content: "<!doctype html><title>folder</title>",
      })
      await write({
        ctx,
        slug: "1o-趋势与行业洞察/具身机器人/index" as FullSlug,
        ext: ".html",
        content: "<!doctype html><title>nested folder</title>",
      })

      const headers = await readFile(join(output, "_headers"), "utf-8")
      assert.strictEqual(headers.match(/^\/\*\/index$/gm)?.length, 1)
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  })

  test("preserves existing unrelated Cloudflare header blocks", async () => {
    const output = await mkdtemp(join(tmpdir(), "quartz-write-"))
    const ctx = { argv: { output } } as BuildCtx
    const existingHeaders = "/assets/*\n  Cache-Control: public, max-age=31536000\n"

    try {
      await mkdir(output, { recursive: true })
      await writeFile(join(output, "_headers"), existingHeaders)
      await write({
        ctx,
        slug: "1o-趋势与行业洞察/index" as FullSlug,
        ext: ".html",
        content: "<!doctype html><title>folder</title>",
      })

      const headers = await readFile(join(output, "_headers"), "utf-8")
      assert(headers.includes(existingHeaders.trimEnd()))
      assert(hasCloudflareHtmlAliasHeaders(headers))
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  })
})
