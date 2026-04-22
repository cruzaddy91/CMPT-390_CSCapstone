/**
 * Pure chart-data builders for athlete PR / total trends (Chart.js-friendly).
 * Keeps AthleteDashboard lean and unit-testable without rendering.
 */

const LIFT_LABELS = { snatch: 'Snatch', clean_jerk: 'Clean & Jerk', total: 'Total' }

const monthKey = (isoDate) => isoDate.slice(0, 7)

const parseMonthKey = (key) => {
  const [y, m] = key.split('-').map(Number)
  return { y, m }
}

const addMonthsKey = (key, delta) => {
  const { y, m } = parseMonthKey(key)
  let mm = m + delta
  let yy = y
  while (mm > 12) {
    mm -= 12
    yy += 1
  }
  while (mm < 1) {
    mm += 12
    yy -= 1
  }
  return `${yy}-${String(mm).padStart(2, '0')}`
}

/** Monthly best per lift — smooths multi-year PR logs for readable line charts. */
export function monthlyBestPrLineData(records, liftTypes = ['snatch', 'clean_jerk', 'total']) {
  const byLiftMonth = new Map()
  const months = new Set()
  for (const r of records) {
    if (!liftTypes.includes(r.lift_type)) continue
    const m = monthKey(r.date)
    months.add(m)
    const k = `${r.lift_type}\t${m}`
    const w = Number(r.weight)
    if (Number.isNaN(w)) continue
    const cur = byLiftMonth.get(k)
    if (cur == null || w > cur) byLiftMonth.set(k, w)
  }
  const labels = [...months].sort()
  const colors = [
    { border: '#5fe4ff', fill: 'rgba(95,228,255,0.14)', point: '#a5ecff' },
    { border: '#36f0c5', fill: 'rgba(54,240,197,0.14)', point: '#7ff7dd' },
    { border: '#ffb23f', fill: 'rgba(255,178,63,0.14)', point: '#ffd489' },
  ]
  return {
    labels,
    datasets: liftTypes.map((lift, i) => ({
      label: LIFT_LABELS[lift] || lift,
      data: labels.map((lab) => {
        const v = byLiftMonth.get(`${lift}\t${lab}`)
        return v == null ? null : v
      }),
      borderColor: colors[i % colors.length].border,
      backgroundColor: colors[i % colors.length].fill,
      pointBackgroundColor: colors[i % colors.length].point,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.32,
      spanGaps: true,
    })),
  }
}

/**
 * Quarter-by-quarter max competition total as a filled line (area).
 * Reads better than bars for long multi-year macrocycle trends.
 */
export function quarterlyBestTotalLineData(records) {
  const totals = records.filter((r) => r.lift_type === 'total')
  const buckets = new Map()
  for (const r of totals) {
    const d = r.date
    const y = Number(d.slice(0, 4))
    const mo = Number(d.slice(5, 7))
    if (!y || !mo) continue
    const q = Math.floor((mo - 1) / 3) + 1
    const key = `${y} Q${q}`
    const w = Number(r.weight)
    if (Number.isNaN(w)) continue
    const cur = buckets.get(key)
    if (cur == null || w > cur) buckets.set(key, w)
  }
  const labels = [...buckets.keys()].sort((a, b) => {
    const [ya, qa] = a.split(' Q').map(Number)
    const [yb, qb] = b.split(' Q').map(Number)
    return ya - yb || qa - qb
  })
  return {
    labels,
    datasets: [{
      label: 'Best competition total (kg)',
      data: labels.map((k) => buckets.get(k)),
      borderColor: 'rgba(95, 228, 255, 0.95)',
      backgroundColor: 'rgba(95, 228, 255, 0.18)',
      borderWidth: 2,
      fill: true,
      tension: 0.22,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#a5ecff',
      spanGaps: true,
    }],
  }
}

/**
 * Line: rolling 6-calendar-month peak competition total (month-end series).
 * Highlights long-horizon strength trend separate from noisy meet-day totals.
 */
export function sixMonthRollingPeakTotalLine(records) {
  const totals = records
    .filter((r) => r.lift_type === 'total')
    .map((r) => ({ d: r.date, w: Number(r.weight) }))
    .filter((r) => !Number.isNaN(r.w))
    .sort((a, b) => a.d.localeCompare(b.d))

  if (totals.length === 0) {
    return { labels: [], datasets: [] }
  }

  const monthKeys = totals.map((r) => monthKey(r.d))
  let cur = monthKeys.reduce((a, b) => (a < b ? a : b))
  const end = monthKeys.reduce((a, b) => (a > b ? a : b))
  const labels = []
  while (cur <= end) {
    labels.push(cur)
    cur = addMonthsKey(cur, 1)
  }

  const maxInMonth = (mk) => {
    let m = -Infinity
    for (const r of totals) {
      if (monthKey(r.d) === mk && r.w > m) m = r.w
    }
    return m
  }

  const data = labels.map((endKey) => {
    let peak = -Infinity
    for (let back = 0; back < 6; back += 1) {
      const mk = addMonthsKey(endKey, -back)
      const v = maxInMonth(mk)
      if (v > peak) peak = v
    }
    return peak === -Infinity ? null : Math.round(peak * 10) / 10
  })

  return {
    labels,
    datasets: [{
      label: '6-mo rolling peak total (kg)',
      data,
      borderColor: '#36f0c5',
      backgroundColor: 'rgba(54,240,197,0.12)',
      pointBackgroundColor: '#7ff7dd',
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: true,
      spanGaps: true,
    }],
  }
}
