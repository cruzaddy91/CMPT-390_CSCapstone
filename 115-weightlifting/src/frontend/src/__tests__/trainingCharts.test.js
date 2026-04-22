import { describe, expect, it } from 'vitest'
import {
  monthlyBestPrLineData,
  quarterlyBestTotalLineData,
  sixMonthRollingPeakTotalLine,
} from '../utils/trainingCharts'

describe('trainingCharts', () => {
  const sample = [
    { date: '2024-01-10', lift_type: 'snatch', weight: '100' },
    { date: '2024-01-20', lift_type: 'snatch', weight: '102' },
    { date: '2024-01-15', lift_type: 'clean_jerk', weight: '125' },
    { date: '2024-01-25', lift_type: 'clean_jerk', weight: '128' },
    { date: '2024-01-22', lift_type: 'total', weight: '228' },
    { date: '2024-04-05', lift_type: 'total', weight: '235' },
    { date: '2024-04-01', lift_type: 'snatch', weight: '105' },
    { date: '2024-04-02', lift_type: 'clean_jerk', weight: '130' },
  ]

  it('monthlyBestPrLineData picks monthly maxima', () => {
    const { labels, datasets } = monthlyBestPrLineData(sample)
    expect(labels).toEqual(['2024-01', '2024-04'])
    const sn = datasets.find((d) => d.label === 'Snatch')
    expect(sn.data).toEqual([102, 105])
  })

  it('quarterlyBestTotalLineData buckets by quarter for area line', () => {
    const { labels, datasets } = quarterlyBestTotalLineData(sample)
    expect(labels).toContain('2024 Q1')
    expect(labels).toContain('2024 Q2')
    expect(datasets[0].data.length).toBe(labels.length)
    expect(datasets[0].fill).toBe(true)
    const q2 = labels.indexOf('2024 Q2')
    expect(datasets[0].data[q2]).toBe(235)
  })

  it('sixMonthRollingPeakTotalLine returns a filled month range', () => {
    const { labels, datasets } = sixMonthRollingPeakTotalLine(sample)
    expect(labels.length).toBeGreaterThanOrEqual(4)
    expect(datasets[0].data.every((v) => v == null || typeof v === 'number')).toBe(true)
  })
})
