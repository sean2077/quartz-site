import test, { describe } from "node:test"
import assert from "node:assert"
import { convertLeetCodeLinks } from "./index"

describe("LeetCodeLinks", () => {
  test("converts numeric problem wikilinks before OFM", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[207.course-schedule|LeetCode 207. 课程表]]"),
      "[LeetCode 207. 课程表](https://leetcode.com/problems/course-schedule/)",
    )
  })

  test("converts LCP problem wikilinks", () => {
    assert.strictEqual(
      convertLeetCodeLinks("[[LCP 01.guess-numbers|猜数字]]"),
      "[猜数字](https://leetcode.com/problems/guess-numbers/)",
    )
  })
})
