// Athlete-side encouragement math. Two numbers drive the hero encouragement
// pill and the humor-toast trigger:
//
//   - streak (consecutive calendar days ending today or yesterday that have
//     at least one workout log). Uses workoutLogs because those records carry
//     an explicit date; per-exercise completion entries do not.
//   - lifetimeCompletions (count of every completed: true flag across every
//     program's completion_data). This is the number we watch for milestone
//     crossings so we can pop a one-time toast with weightlifting-jargon
//     humor the first time the athlete hits 1 / 10 / 25 / 50 / 100 / ...
//
// Humor is intentionally heavy on jargon (CNS, hookgrip, third pull, block
// periodization) per the advisor's "make it fun for lifters, not generic
// fitness" note. Text-only per the no-emoji rule for this app.

const DAY_MS = 24 * 60 * 60 * 1000

// Normalize an ISO-like YYYY-MM-DD to a UTC-midnight Date so arithmetic is
// DST-safe. Returns null on anything we can't parse.
const toUtcMidnight = (dateString) => {
  if (!dateString) return null
  const d = new Date(`${dateString}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

const todayUtcMidnight = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

// Build a set of YYYY-MM-DD strings representing days on which the athlete
// logged at least one workout.
const uniqueLogDates = (workoutLogs) => {
  const set = new Set()
  for (const log of workoutLogs || []) {
    if (log?.date) set.add(String(log.date).slice(0, 10))
  }
  return set
}

// Streak = run of consecutive days ending on today (or yesterday, if the
// athlete hasn't logged yet today). Zero if no log in the last 48h.
export const computeStreak = (workoutLogs, now = new Date()) => {
  const logSet = uniqueLogDates(workoutLogs)
  if (logSet.size === 0) return 0

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const todayKey = today.toISOString().slice(0, 10)
  const yesterdayKey = new Date(today.getTime() - DAY_MS).toISOString().slice(0, 10)

  // Anchor on today if it's logged, else yesterday. If neither is logged,
  // the streak has been broken.
  let cursor
  if (logSet.has(todayKey)) cursor = today
  else if (logSet.has(yesterdayKey)) cursor = new Date(today.getTime() - DAY_MS)
  else return 0

  let count = 0
  while (logSet.has(cursor.toISOString().slice(0, 10))) {
    count += 1
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return count
}

// Sum of every `completed: true` flag across every program's completion_data.
// `completions` shape: { [programId]: { entries: { [dayKey]: { [exIdx]: { completed, ... } } } } }.
export const computeLifetimeCompletions = (completions) => {
  let total = 0
  for (const programId in completions || {}) {
    const entries = completions[programId]?.entries || {}
    for (const dayKey in entries) {
      const dayBag = entries[dayKey] || {}
      for (const exIdx in dayBag) {
        if (dayBag[exIdx]?.completed) total += 1
      }
    }
  }
  return total
}

// Ordered ascending so we can find the highest threshold *just crossed*.
// Humor leans on weightlifting jargon by design -- advisor wanted it lifter-
// flavored, not a generic fitness app tone.
export const COMPLETION_MILESTONES = [
  { count: 1,    message: 'First lift logged. The barbell remembers.' },
  { count: 10,   message: '10 completions. Your CNS is taking notes.' },
  { count: 25,   message: '25 down. Chalk it up -- the third pull is starting to feel like yours.' },
  { count: 50,   message: '50 lifts in. Hookgrip is earning its name.' },
  { count: 100,  message: 'Triple digits. Welcome to the rarefied air of lifters who actually track.' },
  { count: 250,  message: '250 logged. Somewhere a monolift just sighed your name.' },
  { count: 500,  message: '500 reps of work. Bulgarian territory -- hope you are sleeping.' },
  { count: 1000, message: 'Four figures of bar work. You *are* the block periodization.' },
]

export const STREAK_MILESTONES = [
  { count: 3,  message: 'Three-day streak. Habit is forming. So are forearms.' },
  { count: 7,  message: 'Seven days -- a full micro-cycle of consistency.' },
  { count: 14, message: 'Two weeks locked in. Welcome to active recovery\u2019s least-favored child.' },
  { count: 21, message: 'Three weeks. The taper nerds are getting jealous.' },
  { count: 30, message: '30 without missing. Your CNS has sent a strongly-worded letter.' },
  { count: 60, message: '60-day streak. This is no longer training. This is identity.' },
  { count: 90, message: 'Ninety. Deload at your own risk -- momentum has a mind of its own.' },
]

// Given a previous count and a new count, return the milestone JUST crossed
// (the highest threshold strictly greater than `prev` and less-or-equal to
// `next`). Returns null if no threshold was crossed in this step. Callers use
// this to show a one-time toast without any backend state.
const findCrossedMilestone = (prev, next, table) => {
  if (next <= prev) return null
  let crossed = null
  for (const stop of table) {
    if (stop.count > prev && stop.count <= next) crossed = stop
  }
  return crossed
}

export const crossedCompletionMilestone = (prev, next) =>
  findCrossedMilestone(prev, next, COMPLETION_MILESTONES)

export const crossedStreakMilestone = (prev, next) =>
  findCrossedMilestone(prev, next, STREAK_MILESTONES)

// Persisted "already fired" set, keyed per-user so one athlete's celebrations
// don't suppress another's on the same browser. We refuse to re-fire a
// milestone the athlete has already seen, which matters when they unmark and
// remark an exercise (lifetime 1 -> 0 -> 1 would otherwise trigger the
// 'First lift logged' humor twice).
const storageKey = (userId) => `wl_milestones_fired:${userId || 'anon'}`

export const loadFiredMilestones = (userId, storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(storageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed) : new Set()
  } catch {
    return new Set()
  }
}

export const markMilestoneFired = (userId, kind, count, storage = globalThis.localStorage) => {
  const set = loadFiredMilestones(userId, storage)
  set.add(`${kind}:${count}`)
  try { storage?.setItem(storageKey(userId), JSON.stringify([...set])) } catch { /* quota, ignore */ }
  return set
}

export const hasMilestoneFired = (userId, kind, count, storage = globalThis.localStorage) =>
  loadFiredMilestones(userId, storage).has(`${kind}:${count}`)

// Suppress the unused export lint for todayUtcMidnight while leaving it around
// as an internal helper test seams can import if they want to freeze time.
export const __test = { toUtcMidnight, todayUtcMidnight, uniqueLogDates }
