// Horizontal day cells with a per-day completion ring. Clicking a cell swaps
// the dashboard's selected day. Keyboard navigable (tab + Enter/Space).
// Scrolls horizontally on narrow screens so it never forces the viewport wide.

const dayAbbrev = (dayName, fallbackIndex) => {
  if (!dayName) return `D${fallbackIndex + 1}`
  const trimmed = dayName.trim()
  if (/^day\s*\d+$/i.test(trimmed)) return trimmed.replace(/\s+/g, '').toUpperCase()
  return trimmed.slice(0, 3).toUpperCase()
}

const CompletionRing = ({ completed, total, size = 38, active }) => {
  const radius = (size / 2) - 3
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? Math.min(1, completed / total) : 0
  const dashOffset = circumference * (1 - pct)
  const stroke = active ? 'var(--neon-cyan)' : pct === 1 ? 'var(--success)' : 'var(--line-strong)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="week-strip-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(95,228,255,0.14)" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

const WeekStrip = ({ days, completionCounts, selectedDayId, onSelectDay }) => {
  return (
    <div className="week-strip" role="tablist" aria-label="Week days">
      {days.map((day, index) => {
        const counts = completionCounts[day.id] || { completed: 0, total: day.exercises?.length || 0 }
        const isActive = day.id === selectedDayId
        const isFull = counts.total > 0 && counts.completed === counts.total
        return (
          <button
            key={day.id || index}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`week-strip-cell ${isActive ? 'is-active' : ''} ${isFull ? 'is-full' : ''}`}
            onClick={() => onSelectDay(day.id)}
          >
            <span className="week-strip-label">{dayAbbrev(day.day, index)}</span>
            <CompletionRing completed={counts.completed} total={counts.total} active={isActive} />
            <span className="week-strip-ratio data">
              {counts.completed}/{counts.total}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default WeekStrip
