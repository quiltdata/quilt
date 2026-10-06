import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type { Badge } from './badges'

const mocks = vi.hoisted(() => ({
  signedIn: true,
  flag: true,
  badges: [] as Badge[],
}))

vi.mock('react-redux', () => ({ useSelector: () => mocks.signedIn }))
vi.mock('utils/features', () => ({ useFeature: () => mocks.flag }))
vi.mock('utils/NamedRoutes', () => ({
  use: () => ({ urls: { milestones: (id: string) => `/milestones#${id}` } }),
}))
vi.mock('./useMilestones', () => ({ default: () => mocks.badges }))
vi.mock('./ShareMenu', () => ({ ShareButton: () => <button>share</button> }))

import Ribbon from './Ribbon'

const badge = (id: string, kind: 'earned' | 'locked', at: Date | null = null): Badge => ({
  id,
  title: id,
  description: '',
  category: 'Packages',
  icon: 'layers',
  unit: 'count',
  state: kind === 'earned' ? { kind, at } : { kind, value: 1, target: 2 },
})

const renderRibbon = () =>
  render(
    <MemoryRouter>
      <Ribbon />
    </MemoryRouter>,
  )

describe('containers/Milestones/Ribbon', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.signedIn = true
    mocks.flag = true
    mocks.badges = [
      badge('older', 'earned', new Date('2024-01-01')),
      badge('newest', 'earned', new Date('2026-01-01')),
      badge('undated', 'earned'),
      badge('locked', 'locked'),
    ]
  })

  it('leads with the newest earned badge and counts the rest', () => {
    renderRibbon()
    expect(screen.getByText('newest')).toBeTruthy()
    expect(screen.getByText('and 2 more')).toBeTruthy()
  })

  it('stays dismissed, and comes back only for a badge earned later', () => {
    const { unmount } = renderRibbon()
    fireEvent.click(screen.getByLabelText('Dismiss milestones'))
    expect(screen.queryByLabelText('Milestones reached')).toBeNull()
    unmount()

    renderRibbon()
    expect(screen.queryByLabelText('Milestones reached')).toBeNull()

    mocks.badges = [...mocks.badges, badge('fresh', 'earned', new Date('2026-02-01'))]
    renderRibbon()
    expect(screen.getByText('fresh')).toBeTruthy()
    expect(screen.queryByText(/more/)).toBeNull()
  })

  it('shows nothing signed out or with the feature off', () => {
    mocks.signedIn = false
    renderRibbon()
    expect(screen.queryByLabelText('Milestones reached')).toBeNull()
    mocks.signedIn = true
    mocks.flag = false
    renderRibbon()
    expect(screen.queryByLabelText('Milestones reached')).toBeNull()
  })
})
