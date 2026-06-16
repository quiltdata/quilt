import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import QuratorInline from './QuratorInline'

const useIsEnabled = vi.fn()
const useAssistantAPI = vi.fn()

vi.mock('components/Assistant', () => ({
  Model: {
    useIsEnabled: () => useIsEnabled(),
    useAssistantAPI: () => useAssistantAPI(),
  },
}))

vi.mock('components/Assistant/UI/Chat/Chat', () => ({
  default: () => <div data-testid="qurator-chat" />,
}))

function makeAPI() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    state: {},
    dispatch: vi.fn(),
    devTools: {},
    connectors: {},
  }
}

describe('containers/Bucket/Overview/v2/QuratorInline', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders nothing when Qurator is disabled', () => {
    useIsEnabled.mockReturnValue(false)
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByTestId } = render(<QuratorInline />)
    expect(queryByTestId('qurator-chat')).toBeFalsy()
  })

  it('renders nothing when the API is unavailable', () => {
    useIsEnabled.mockReturnValue(true)
    useAssistantAPI.mockReturnValue(null)
    const { queryByTestId } = render(<QuratorInline />)
    expect(queryByTestId('qurator-chat')).toBeFalsy()
  })

  it('renders the inline chat without opening the drawer', () => {
    const api = makeAPI()
    useIsEnabled.mockReturnValue(true)
    useAssistantAPI.mockReturnValue(api)
    const { getByTestId } = render(<QuratorInline />)
    expect(getByTestId('qurator-chat')).toBeTruthy()
    expect(api.show).not.toHaveBeenCalled()
  })
})
