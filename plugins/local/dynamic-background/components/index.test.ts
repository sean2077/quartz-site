import test from "node:test"
import assert from "node:assert/strict"
import { runInNewContext } from "node:vm"
import { dynamicBackgroundScript } from "./index.ts"

function createClock(hour: number, minute = 0) {
  const clock = { now: new Date(2026, 10, 24, hour, minute).getTime() }
  class ClockDate extends Date {
    constructor(value?: number | Date) {
      super(value === undefined ? clock.now : Number(value))
    }
  }
  const attributes = new Map<string, string>()
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: {
      setAttribute(name: string, value: string) {
        attributes.set(name, value)
      },
    },
  })
  let timerId = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  const window = Object.assign(new EventTarget(), {
    setTimeout(callback: () => void, delay: number) {
      timers.set(++timerId, { callback, delay })
      return timerId
    },
    clearTimeout(id: number) {
      timers.delete(id)
    },
  })
  runInNewContext(dynamicBackgroundScript, { document, window, Date: ClockDate })
  return { clock, attributes, timers, document, window }
}

test("background phases change at each local-time boundary, including midnight", () => {
  for (const [hour, expected, nextHour] of [
    [0, "night", 5],
    [5, "dawn", 7],
    [7, "morning", 12],
    [12, "noon", 14],
    [14, "afternoon", 17],
    [17, "dusk", 19],
    [19, "night", 29],
    [23, "night", 29],
  ] as const) {
    const { attributes, timers } = createClock(hour)
    assert.equal(attributes.get("data-time-phase"), expected)
    assert.equal(timers.size, 1)
    assert.equal([...timers.values()][0].delay, (nextHour - hour) * 3_600_000)
  }
})

test("background clock suspends while hidden and restores exactly one timer", () => {
  const { clock, attributes, timers, document, window } = createClock(6, 59)
  assert.equal([...timers.values()][0].delay, 60_000)

  document.hidden = true
  document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(timers.size, 0)

  clock.now = new Date(2026, 10, 24, 14, 30).getTime()
  document.hidden = false
  document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(attributes.get("data-time-phase"), "afternoon")
  assert.equal(timers.size, 1)
  assert.equal([...timers.values()][0].delay, 150 * 60_000)

  window.dispatchEvent(new Event("pagehide"))
  assert.equal(timers.size, 0)
  window.dispatchEvent(new Event("pageshow"))
  window.dispatchEvent(new Event("pageshow"))
  assert.equal(timers.size, 1)

  // When the boundary fires, replace the old timer rather than adding a poller.
  clock.now = new Date(2026, 10, 24, 17, 0).getTime()
  ;[...timers.values()][0].callback()
  assert.equal(attributes.get("data-time-phase"), "dusk")
  assert.equal(timers.size, 1)
})
