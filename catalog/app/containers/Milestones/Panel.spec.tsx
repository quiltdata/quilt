import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { deriveBadges, type Badge, type Metrics } from './badges'

const mocks = vi.hoisted(() => ({
  badges: undefined as Badge[] | undefined,
  push: vi.fn(),
}))

vi.mock('./useMilestones', () => ({ default: () => mocks.badges }))
vi.mock('containers/Notifications', () => ({ use: () => ({ push: mocks.push }) }))

import Panel from './Panel'

const NOW = new Date('2026-10-06T00:00:00Z')

const metrics: Metrics = {
  packages: 150,
  largestBytes: 5e11,
  largestFiles: 10,
  totalBytes: 0,
  buckets: 1,
  mostRevisions: 1,
  activeUsers: 3,
  firstPackageAt: new Date('2026-01-02T12:00:00Z'),
  firstMultiTbAt: null,
  firstWorkflowAt: null,
}

const tile = (id: string) => screen.getByTestId(`badge-${id}`)

describe('containers/Milestones/Panel', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    mocks.push.mockReset()
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('shows a progress bar while loading', () => {
    mocks.badges = undefined
    render(<Panel />)
    expect(screen.getByLabelText('Loading milestones')).toBeTruthy()
  })

  it('reads every badge as unavailable when the registry cannot say', () => {
    mocks.badges = deriveBadges(null, NOW)
    render(<Panel />)
    expect(screen.getAllByText('Unavailable right now')).toHaveLength(mocks.badges.length)
  })

  it('shows earned dates and locked progress', () => {
    mocks.badges = deriveBadges(metrics, NOW)
    render(<Panel />)
    expect(within(tile('first-package')).getByText('Earned Jan 2, 2026')).toBeTruthy()
    expect(within(tile('packages-1000')).getByText('150 of 1,000')).toBeTruthy()
    expect(within(tile('anniversary-1')).getByText(/of 365 days/)).toBeTruthy()
    expect(within(tile('packages-1000')).queryByLabelText(/^Share/)).toBeNull()
  })

  it('copies a Slack message with the badge link', async () => {
    mocks.badges = deriveBadges(metrics, NOW)
    render(<Panel />)
    fireEvent.click(within(tile('first-package')).getByLabelText(/^Share/))
    fireEvent.click(screen.getByText('Copy for Slack'))
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('Copied. Paste it into a Slack message.'),
    )
    expect(writeText.mock.calls[0][0]).toMatch(/\/milestones#first-package$/)
  })
})
