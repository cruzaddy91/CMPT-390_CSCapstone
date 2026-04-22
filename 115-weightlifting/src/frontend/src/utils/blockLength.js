// Coaches think in blocks (2-week test, 4-week accumulation, 8-week build,
// 12-week prep) rather than exact end dates. These helpers convert a start
// date plus a block preset into an end date.

export const BLOCK_PRESETS = [
  { key: '2wk',   label: '2 wk',  weeks: 2 },
  { key: '4wk',   label: '4 wk',  weeks: 4 },
  { key: '8wk',   label: '8 wk',  weeks: 8 },
  { key: '12wk',  label: '12 wk', weeks: 12 },
]

export const endDateForBlock = (startDateISO, weeks) => {
  if (!startDateISO || !Number.isFinite(weeks) || weeks <= 0) return ''
  const start = new Date(`${startDateISO}T00:00:00`)
  if (Number.isNaN(start.getTime())) return ''
  // Block of N weeks runs from Monday week 1 to Sunday week N, so we add
  // N*7 - 1 days from the start date.
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7 - 1)
  return end.toISOString().split('T')[0]
}

export const inferBlockKey = (startDateISO, endDateISO) => {
  if (!startDateISO || !endDateISO) return 'custom'
  const start = new Date(`${startDateISO}T00:00:00`)
  const end = new Date(`${endDateISO}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'custom'
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
  const match = BLOCK_PRESETS.find((b) => b.weeks * 7 === diffDays)
  return match ? match.key : 'custom'
}
