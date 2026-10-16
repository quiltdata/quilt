import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ badges: false }))

vi.mock('utils/features', () => ({ useFeature: () => mocks.badges }))
vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({ status: { __typename: 'Unavailable' } }),
}))
vi.mock('utils/MetaTitle', () => ({ default: () => null }))
vi.mock('./Indexing', () => ({ default: () => null }))
vi.mock('./Canaries', () => ({ default: () => null }))
vi.mock('./Reports', () => ({ default: () => null }))
vi.mock('./Stats', () => ({ default: () => null }))
vi.mock('containers/Milestones', () => ({ Panel: () => <div>Milestones panel</div> }))

import Status from './Status'

describe('containers/Admin/Status/Status', () => {
  it('renders no Milestones panel with the feature off', () => {
    mocks.badges = false
    render(<Status />)
    expect(screen.queryByText('Milestones panel')).toBeNull()
  })

  it('renders the Milestones panel with the feature on', () => {
    mocks.badges = true
    render(<Status />)
    expect(screen.getByText('Milestones panel')).toBeTruthy()
  })
})
