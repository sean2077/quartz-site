// 根据当前时间获取时间段
function getTimePhase(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 7) return "dawn"
  if (hour >= 7 && hour < 12) return "morning"
  if (hour >= 12 && hour < 14) return "noon"
  if (hour >= 14 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 19) return "dusk"
  return "night"
}

// 立即设置时间段属性（防止闪烁）
document.documentElement.setAttribute("data-time-phase", getTimePhase())

// 每分钟检查时间变化
setInterval(() => {
  const newPhase = getTimePhase()
  const currentPhase = document.documentElement.getAttribute("data-time-phase")
  if (newPhase !== currentPhase) {
    document.documentElement.setAttribute("data-time-phase", newPhase)
  }
}, 60000)
