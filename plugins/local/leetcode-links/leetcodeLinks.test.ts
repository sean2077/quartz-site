import test, { describe } from "node:test"
import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { buildLeetCodeProblemIndex, convertLeetCodeLinks } from "./index"

const problemIndex = new Map([
  ["207.course-schedule", "https://leetcode.com/problems/course-schedule/"],
  ["LCP 01.guess-numbers", "https://leetcode.com/problems/guess-numbers/"],
])

describe("LeetCodeLinks", () => {
  test("converts numeric problem wikilinks before OFM", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[207.course-schedule|LeetCode 207. 课程表]]", problemIndex),
      "[LeetCode 207. 课程表](https://leetcode.com/problems/course-schedule/)",
    )
  })

  test("converts LCP problem wikilinks", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[LCP 01.guess-numbers|猜数字]]", problemIndex),
      "[猜数字](https://leetcode.com/problems/guess-numbers/)",
    )
  })

  test("converts escaped-alias links in markdown tables", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[207.course-schedule\\|LeetCode 207. 课程表]]", problemIndex),
      "[LeetCode 207. 课程表](https://leetcode.com/problems/course-schedule/)",
    )
  })

  test("does not convert numeric links absent from the LeetCode problem index", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[207.course-schedule|LeetCode 207. 课程表]]"),
      "[[207.course-schedule|LeetCode 207. 课程表]]",
    )
  })

  test("does not convert local numbered module wikilinks", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[01.算法基础|01.算法基础]]", problemIndex),
      "[[01.算法基础|01.算法基础]]",
    )
  })

  test("does not convert local numbered wikilinks with anchors", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[01.复杂度#主定理-master-theorem|主定理]]", problemIndex),
      "[[01.复杂度#主定理-master-theorem|主定理]]",
    )
  })

  test("does not convert local ascii numbered wikilinks without a LeetCode label", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[16.15-puzzle|15-puzzle]]", problemIndex),
      "[[16.15-puzzle|15-puzzle]]",
    )
  })

  test("builds a problem index only from tagged LeetCode cards", () => {
    const dir = mkdtempSync(join(tmpdir(), "leetcode-links-"))
    const problemsDir = join(dir, "1Y LeetCode", "lc-problems")

    try {
      mkdirSync(problemsDir, { recursive: true })
      writeFileSync(
        join(problemsDir, "207.course-schedule.md"),
        `---
tags:
  - leetcode/problem
questionId: "207"
titleSlug: course-schedule
lcLinks:
  - https://leetcode.com/problems/course-schedule/
---
`,
        { flag: "wx", flush: true },
      )
      writeFileSync(
        join(problemsDir, "16.15-puzzle.md"),
        `---
tags:
  - type/note
questionId: "16"
titleSlug: 15-puzzle
lcLinks:
  - https://leetcode.com/problems/sliding-puzzle/
---
`,
        { flag: "wx", flush: true },
      )

      const index = buildLeetCodeProblemIndex(problemsDir, dir)
      assert.equal(
        index.get("207.course-schedule"),
        "https://leetcode.com/problems/course-schedule/",
      )
      assert.equal(
        index.get("1Y LeetCode/lc-problems/207.course-schedule"),
        "https://leetcode.com/problems/course-schedule/",
      )
      assert.equal(index.has("16.15-puzzle"), false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
