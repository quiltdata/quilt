import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'

import QuratorInline from './QuratorInline'

vi.mock('constants/config', () => ({ default: {} }))

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

vi.mock('components/Assistant/UI/InlinePresence', () => ({
  Provide: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
}))

const quratorPref = vi.hoisted(() => vi.fn<() => boolean>(() => true))
vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<typeof BucketPreferences>(
    'utils/BucketPreferences',
  )
  return {
    ...actual,
    use: () => ({
      prefs: actual.Result.Ok({
        ui: { blocks: { qurator: quratorPref() } },
      } as unknown as Parameters<typeof actual.Result.Ok>[0]),
    }),
  }
})

function makeAPI() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    state: { events: [] as unknown[] },
    dispatch: vi.fn(),
    devTools: {},
    connectors: {},
  }
}

describe('containers/Bucket/Overview/v2/QuratorInline', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    quratorPref.mockReturnValue(true)
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

  it('renders nothing when the qurator block is disabled, even if enabled with an API', () => {
    quratorPref.mockReturnValue(false)
    useIsEnabled.mockReturnValue(true)
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByTestId } = render(<QuratorInline />)
    expect(queryByTestId('qurator-chat')).toBeFalsy()
  })

  it('renders the inline chat when the qurator block is enabled with an API', () => {
    const api = makeAPI()
    quratorPref.mockReturnValue(true)
    useIsEnabled.mockReturnValue(true)
    useAssistantAPI.mockReturnValue(api)
    const { getByTestId } = render(<QuratorInline />)
    expect(getByTestId('qurator-chat')).toBeTruthy()
    expect(api.show).not.toHaveBeenCalled()
  })

  it('opens the sidebar on unmount when there is conversation history', () => {
    const api = makeAPI()
    api.state = { events: [{ id: '1' }] }
    useIsEnabled.mockReturnValue(true)
    useAssistantAPI.mockReturnValue(api)
    const { unmount } = render(<QuratorInline />)
    expect(api.show).not.toHaveBeenCalled()
    unmount()
    expect(api.show).toHaveBeenCalled()
  })

  it('does not open the sidebar on unmount with no history', () => {
    const api = makeAPI()
    useIsEnabled.mockReturnValue(true)
    useAssistantAPI.mockReturnValue(api)
    const { unmount } = render(<QuratorInline />)
    unmount()
    expect(api.show).not.toHaveBeenCalled()
  })
})
