import { test as base, expect, type Page, type Locator, type TestInfo } from "@playwright/test"

type BrowserLog = { errors: string[]; backgrounds: string[] }

const test = base.extend<{ browserLog: BrowserLog }>({
  browserLog: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) throw new Error("Browser tests require the synthetic site's baseURL")
      const origin = new URL(baseURL).origin
      const log: BrowserLog = { errors: [], backgrounds: [] }
      page.on("pageerror", (error) => log.errors.push(error.message))
      page.on("request", (request) => {
        const pathname = decodeURIComponent(new URL(request.url()).pathname)
        if (pathname.includes("/static/A day in the corner of the city/")) {
          log.backgrounds.push(pathname)
        }
      })
      // Font CDNs, analytics, and other external services are not part of the
      // local regression contract. Do not let their availability decide CI.
      await page.route("**/*", async (route) => {
        if (new URL(route.request().url()).origin === origin) await route.continue()
        else await route.abort()
      })
      // Fix only Date, leaving debounce and animation timers operational.
      await page.clock.setFixedTime(new Date("2026-11-24T02:00:00Z"))
      await use(log)
      expect(log.errors, "Client scripts must not throw uncaught exceptions").toEqual([])
    },
    { auto: true },
  ],
})

async function openNotebook(page: Page, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ colorScheme: theme })
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.locator(".article-title")).toHaveText("阅读与记录")
  await expect(page.locator("html")).toHaveAttribute("saved-theme", theme)
  await expect(page.locator(".base-paginated-table")).toHaveAttribute("data-initialized", "true")
}

function paginated(page: Page) {
  return page.locator(".base-paginated-table")
}

async function expectRanks(view: Locator, ranks: number[]) {
  await expect(view.locator("tbody tr")).toHaveCount(ranks.length)
  await expect(view.locator("tbody tr td:nth-child(2)")).toHaveText(ranks.map(String))
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => {
    const center = document.querySelector(".center")!.getBoundingClientRect()
    return {
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      centerLeft: center.left,
      centerRight: center.right,
    }
  })
  expect(geometry.document, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport + 1)
  expect(geometry.body, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport + 1)
  expect(geometry.centerLeft).toBeGreaterThanOrEqual(-1)
  expect(geometry.centerRight).toBeLessThanOrEqual(geometry.viewport + 1)
}

async function captureReview(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: false, animations: "disabled" })
  await testInfo.attach(name, { path, contentType: "image/png" })
}

for (const width of [320, 390, 1024, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`${width}px ${theme}: readable layout and responsive WebP background`, async ({
      page,
      browserLog,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 })
      await openNotebook(page, theme)
      await expectRanks(
        paginated(page),
        Array.from({ length: 10 }, (_, i) => i + 1),
      )
      await expectNoHorizontalOverflow(page)

      const expectedImage = `morning-${width <= 800 ? 800 : 1600}.webp`
      await expect(page.locator("html")).toHaveAttribute("data-time-phase", "morning")
      await expect(page.locator(".dynamic-background")).toHaveCSS(
        "background-image",
        new RegExp(`${expectedImage.replace(".", "\\.")}["')]*$`),
      )
      await expect
        .poll(() => browserLog.backgrounds.some((pathname) => pathname.endsWith(expectedImage)))
        .toBe(true)
      expect(browserLog.backgrounds.filter((pathname) => /\.(png|jpe?g)$/i.test(pathname))).toEqual(
        [],
      )
      await expect(page.locator(".mobile-toc-toggle")).toBeVisible({ visible: width <= 800 })
      if (width === 1440) await captureReview(page, testInfo, `desktop-${theme}`)
    })
  }
}

test("Bases paginates all 45 rows, searches detached rows, and sorts numerically", async ({
  page,
}) => {
  await openNotebook(page)
  const view = paginated(page)
  const next = view.getByRole("button", { name: "Next page", exact: true })
  const previous = view.getByRole("button", { name: "Previous page", exact: true })
  const search = view.getByRole("textbox", { name: "Search table", exact: true })
  await expect(view.getByRole("status")).toHaveText("1-10 of 45")
  await expect(previous).toBeDisabled()

  await next.click()
  await expectRanks(
    view,
    Array.from({ length: 10 }, (_, i) => i + 11),
  )
  await expect(view.getByRole("status")).toHaveText("11-20 of 45")
  await previous.click()
  await expectRanks(
    view,
    Array.from({ length: 10 }, (_, i) => i + 1),
  )

  // Sample 45 was never mounted on either visited page.
  await search.fill("Sample 45")
  await expectRanks(view, [45])
  await expect(view.getByRole("status")).toHaveText("1-1 of 1")
  await expect(next).toBeDisabled()
  await search.fill("no such sample exists")
  await expectRanks(view, [])
  await expect(view.getByRole("status")).toHaveText("No results")
  await search.fill("")
  await expect(view.getByRole("status")).toHaveText("1-10 of 45")

  const rankHeading = view.locator('th[data-property="rank"]')
  await rankHeading.click()
  await expectRanks(
    view,
    Array.from({ length: 10 }, (_, i) => i + 1),
  )
  await rankHeading.click()
  await expectRanks(
    view,
    Array.from({ length: 10 }, (_, i) => 45 - i),
  )
  await view.getByRole("combobox", { name: "Items per page", exact: true }).selectOption("25")
  await expectRanks(
    view,
    Array.from({ length: 25 }, (_, i) => 45 - i),
  )
  await next.click()
  await expectRanks(
    view,
    Array.from({ length: 20 }, (_, i) => 20 - i),
  )
  await expect(view.getByRole("status")).toHaveText("26-45 of 45")
  await expect(next).toBeDisabled()
})

test("Bases tabs retain independent filtering, limits and sort order", async ({ page }) => {
  await openNotebook(page)
  await page.getByRole("button", { name: "已完成", exact: true }).click()
  const completed = page.locator(".base-table")
  await expect(completed).toBeVisible()
  await expect(paginated(page)).not.toBeVisible()
  await expectRanks(completed, [44, 42, 40])
  await expect(completed.locator("tbody tr td:nth-child(3)")).toHaveText(["done", "done", "done"])
  await completed.locator('th[data-property="rank"]').click()
  await expectRanks(completed, [40, 42, 44])

  await page.getByRole("button", { name: "全部笔记", exact: true }).click()
  await expectRanks(
    paginated(page),
    Array.from({ length: 10 }, (_, i) => i + 1),
  )
  await expect(paginated(page).getByRole("status")).toHaveText("1-10 of 45")
})

test("newly mounted Bases links retain popovers after pagination round trips", async ({ page }) => {
  await openNotebook(page)
  const view = paginated(page)
  for (let visit = 0; visit < 2; visit++) {
    await view.getByRole("button", { name: "Next page", exact: true }).click()
    await expect(view.getByRole("status")).toHaveText("11-20 of 45")
    await view.getByRole("link", { name: "Sample 11", exact: true }).hover()
    const preview = page.locator(".popover.active-popover")
    await expect(preview).toHaveCount(1)
    await expect(preview).toBeVisible()
    await expect(preview.locator(".article-title")).toHaveText("Sample 11")
    await page.mouse.move(1, 1)
    await expect(preview).toHaveCount(0)
    if (visit === 0) {
      await view.getByRole("button", { name: "Previous page", exact: true }).click()
      await expect(view.getByRole("status")).toHaveText("1-10 of 45")
    }
  }
  // Updating table DOM must not rebind global toolbar controls multiple times.
  await page.evaluate(() => {
    let changes = 0
    document.addEventListener("themechange", () => {
      document.documentElement.setAttribute("data-smoke-theme-changes", String(++changes))
    })
  })
  await page.locator(".darkmode").click()
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "dark")
  await expect(page.locator("html")).toHaveAttribute("data-smoke-theme-changes", "1")
  await page.locator(".darkmode").click()
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
  await expect(page.locator("html")).toHaveAttribute("data-smoke-theme-changes", "2")
})

test("mobile TOC is a native modal with focus, Escape, restoration and resize cleanup", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openNotebook(page)
  const toggle = page.locator(".mobile-toc-toggle")
  const dialog = page.getByRole("dialog", { name: "目录", exact: true })
  const close = page.getByRole("button", { name: "关闭目录", exact: true })
  const initialOverflow = await page.evaluate(() => document.body.style.overflow)
  await expect(dialog).not.toBeVisible()
  await toggle.click()
  await expect(dialog).toBeVisible()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true)
  await expect(close).toBeFocused()
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden")
  const lastLink = dialog.getByRole("link").last()
  await lastLink.focus()
  await page.keyboard.press("Tab")
  await expect(close).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(lastLink).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(close).toBeFocused()
  await captureReview(page, testInfo, "mobile-toc")

  await page.keyboard.press("Escape")
  await expect(dialog).not.toBeVisible()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(toggle).toBeFocused()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(initialOverflow)

  await toggle.click()
  await expect(dialog).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(dialog).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(initialOverflow)
  await page.setViewportSize({ width: 390, height: 844 })
  await toggle.click()
  await expect(dialog).toBeVisible()
  await close.click()
  await expect(dialog).not.toBeVisible()
})

test("SPA navigation and Back restore the complete Bases dataset and fresh controls", async ({
  page,
}) => {
  await openNotebook(page)
  await page
    .locator("html")
    .evaluate((element) => element.setAttribute("data-smoke-document", "same"))
  await paginated(page).getByRole("button", { name: "Next page", exact: true }).click()
  await expect(paginated(page).getByRole("status")).toHaveText("11-20 of 45")
  await page
    .locator(".center > article")
    .getByRole("link", { name: "阅读与思考", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/notes\/reading$/)
  await expect(page.locator(".article-title")).toHaveText("阅读与思考")
  await expect(page.locator("html")).toHaveAttribute("data-smoke-document", "same")

  await page.goBack()
  await expect(page.locator(".article-title")).toHaveText("阅读与记录")
  await expect(page.locator("html")).toHaveAttribute("data-smoke-document", "same")
  await expect(paginated(page)).toHaveAttribute("data-initialized", "true")
  await expectRanks(
    paginated(page),
    Array.from({ length: 10 }, (_, i) => i + 1),
  )
  for (let pageIndex = 1; pageIndex <= 4; pageIndex++) {
    await paginated(page).getByRole("button", { name: "Next page", exact: true }).click()
    const start = pageIndex * 10 + 1
    await expect(paginated(page).getByRole("status")).toHaveText(
      `${start}-${Math.min(start + 9, 45)} of 45`,
    )
  }
  await expectRanks(paginated(page), [41, 42, 43, 44, 45])
})

test("site search opens a local result and returns without a document reload", async ({ page }) => {
  await openNotebook(page)
  await page.locator(".search-button").click()
  await expect(page.locator(".search-bar")).toBeVisible()
  await page.locator(".search-bar").fill("Sample 45")
  const result = page.locator('.result-card[id="samples/note-45"]')
  await expect(result).toBeVisible()
  await expect(result.locator(".card-title")).toHaveText("Sample 45")
  await page
    .locator("html")
    .evaluate((element) => element.setAttribute("data-smoke-document", "search"))
  await result.click()
  await expect(page).toHaveURL(/\/samples\/note-45$/)
  await expect(page.locator(".article-title")).toHaveText("Sample 45")
  await expect(page.locator("html")).toHaveAttribute("data-smoke-document", "search")
  await page.goBack()
  await expect(page.locator(".article-title")).toHaveText("阅读与记录")
  await expect(paginated(page)).toHaveAttribute("data-initialized", "true")
})
