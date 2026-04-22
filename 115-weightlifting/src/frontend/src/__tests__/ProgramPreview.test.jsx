import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProgramPreview from '../components/ProgramPreview'

const programFixture = {
  week_start_date: '2026-04-21',
  days: [
    {
      day: 'Monday',
      exercises: [
        { name: 'Snatch', sets: '5', reps: '2', percent_1rm: '75%', tempo: '', rest: '2min', notes: 'Fast' },
      ],
    },
  ],
}

afterEach(() => {
  // preview modal locks body scroll; make sure nothing leaks between tests
  document.body.style.overflow = ''
})

describe('ProgramPreview', () => {
  it('renders the program name, athlete, and day contents', () => {
    render(<ProgramPreview programData={programFixture} programName="Block 1" athleteUsername="athlete_a" onClose={() => {}} />)
    expect(screen.getByText('Block 1')).toBeTruthy()
    expect(screen.getByText(/for athlete_a/i)).toBeTruthy()
    expect(screen.getByText('Snatch')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it("falls back to 'Untitled program' when no name is provided", () => {
    render(<ProgramPreview programData={programFixture} programName="" athleteUsername="" onClose={() => {}} />)
    expect(screen.getByText(/untitled program/i)).toBeTruthy()
  })

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn()
    render(<ProgramPreview programData={programFixture} programName="Block 1" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<ProgramPreview programData={programFixture} programName="Block 1" onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('locks body scroll while mounted and restores it on unmount', () => {
    const { unmount } = render(<ProgramPreview programData={programFixture} programName="Block 1" onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
