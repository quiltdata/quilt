import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const historyPush = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: historyPush }),
}))

const useUnifiedSuggestions = vi.hoisted(() => vi.fn(() => [] as any[]))
vi.mock('../useUnifiedSuggestions', () => ({
  default: useUnifiedSuggestions,
}))

const useRelevantBuckets = vi.hoisted(() => vi.fn(() => [] as { name: string }[]))
vi.mock('utils/Buckets', () => ({
  useRelevantBuckets,
}))

import SearchSuggestions from './SearchSuggestions'

describe('website/pages/Landing/FrontDoor/UnifiedBar/SearchSuggestions', () => {
  afterEach(() => {
    cleanup()
    historyPush.mockClear()
    useUnifiedSuggestions.mockReset()
    useUnifiedSuggestions.mockReturnValue([])
    useRelevantBuckets.mockReset()
    useRelevantBuckets.mockReturnValue([])
  })

  it('renders nothing for an empty query with no suggestions', () => {
    const { container } = render(
      <SearchSuggestions query="" quratorEnabled onAskQurator={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the canonical scope rows', () => {
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={vi.fn()} />,
    )
    expect(getByText('packages')).toBeTruthy()
    expect(getByText('objects')).toBeTruthy()
    expect(getByText('tables')).toBeTruthy()
  })

  it('routes the packages row to global package search', () => {
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={vi.fn()} />,
    )
    fireEvent.click(getByText('packages'))
    expect(historyPush).toHaveBeenCalledWith('/search?q=drugbank')
  })

  it('routes the objects row to global object search (t=o)', () => {
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={vi.fn()} />,
    )
    fireEvent.click(getByText('objects'))
    expect(historyPush).toHaveBeenCalledWith('/search?q=drugbank&t=o')
  })

  it('routes the tables row to the relevant bucket Athena page', () => {
    useRelevantBuckets.mockReturnValue([{ name: 'quilt-drugbank' }])
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={vi.fn()} />,
    )
    fireEvent.click(getByText('tables'))
    expect(historyPush).toHaveBeenCalledWith('/b/quilt-drugbank/queries/athena')
  })

  it('falls back to search for tables when no bucket is available', () => {
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={vi.fn()} />,
    )
    fireEvent.click(getByText('tables'))
    expect(historyPush).toHaveBeenCalledWith('/search?q=drugbank')
  })

  it('renders the Qurator downgrade row when Qurator is enabled', () => {
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={vi.fn()} />,
    )
    expect(getByText(/Ask Qurator about/)).toBeTruthy()
  })

  it('omits the Qurator downgrade row when Qurator is disabled', () => {
    const { queryByText } = render(
      <SearchSuggestions
        query="drugbank"
        quratorEnabled={false}
        onAskQurator={vi.fn()}
      />,
    )
    expect(queryByText(/Ask Qurator about/)).toBeNull()
  })

  it('invokes onAskQurator when the downgrade row is clicked', () => {
    const onAskQurator = vi.fn()
    const { getByText } = render(
      <SearchSuggestions query="drugbank" quratorEnabled onAskQurator={onAskQurator} />,
    )
    fireEvent.click(getByText(/Ask Qurator about/))
    expect(onAskQurator).toHaveBeenCalledTimes(1)
  })
})
