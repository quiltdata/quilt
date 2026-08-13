import * as React from 'react'
import * as M from '@material-ui/core'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'

vi.mock('constants/config', () => ({ default: {} }))

const historyPush = vi.fn()
const useIsEnabled = vi.fn(() => true)
const assist = vi.fn()

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: historyPush }),
}))

vi.mock('components/Assistant', () => ({
  Model: {
    useIsEnabled: () => useIsEnabled(),
    useAssistant: () => assist,
  },
}))

vi.mock('../useUnifiedSuggestions', () => ({ default: () => [] }))

vi.mock('utils/Buckets', () => ({ useRelevantBuckets: () => [] }))

import UnifiedBar from './UnifiedBar'

// The bar's styles read app-theme extensions (typography.monospace), so render
// under the same theme the app provides.
const renderBar = (props: React.ComponentProps<typeof UnifiedBar>) =>
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <UnifiedBar {...props} />
    </M.MuiThemeProvider>,
  )

describe('website/pages/Landing/FrontDoor/UnifiedBar/UnifiedBar', () => {
  afterEach(() => {
    cleanup()
    historyPush.mockClear()
    assist.mockClear()
    useIsEnabled.mockReset()
    useIsEnabled.mockReturnValue(true)
  })

  it('renders without error', () => {
    const { getByLabelText } = renderBar({ value: '', onChange: vi.fn() })
    expect(getByLabelText('Search or ask Qurator')).toBeTruthy()
  })

  it('navigates to the existing search route for Search submissions', () => {
    const { getByLabelText } = renderBar({ value: 'drugbank', onChange: vi.fn() })
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).toHaveBeenCalledWith('/search?q=drugbank')
  })

  it('opens the real Assistant when the classifier routes to Qurator', () => {
    const { getByLabelText } = renderBar({
      value: 'what data exists?',
      onChange: vi.fn(),
    })
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).not.toHaveBeenCalled()
    expect(assist).toHaveBeenCalledWith('what data exists?')
  })

  it('shows the Qurator interpreted-plan panel for question queries', () => {
    const { getByText } = renderBar({ value: 'what data exists?', onChange: vi.fn() })
    expect(getByText('Run with Qurator')).toBeTruthy()
    expect(getByText(/will plan/)).toBeTruthy()
  })

  it('downgrades to plain search when "Just search instead" is clicked', () => {
    const { getByText, getByLabelText } = renderBar({
      value: 'what data exists?',
      onChange: vi.fn(),
    })
    fireEvent.click(getByText('Just search instead'))
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).toHaveBeenCalledWith('/search?q=what%20data%20exists%3F')
  })

  it('collapses to Search behavior when Qurator is disabled', () => {
    useIsEnabled.mockReturnValue(false)
    const { getByLabelText, queryByText } = renderBar({
      value: 'what data exists?',
      onChange: vi.fn(),
    })
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).toHaveBeenCalledWith('/search?q=what%20data%20exists%3F')
    expect(queryByText('Qurator')).toBeNull()
  })
})
