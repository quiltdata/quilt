import { mocked } from 'ts-jest/utils'
import { renderHook } from '@testing-library/react-hooks'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import AsyncResult from 'utils/AsyncResult'
import global from 'utils/global'

import useViewModes from './viewModes'

jest.mock('utils/global')

function fetchOk(): Promise<Response> {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve({
        ok: true,
      } as Response)
    }, 100),
  )
}

function fetchNotOk(): Promise<Response> {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve({
        ok: false,
      } as Response)
    }, 100),
  )
}

const jsonResult = AsyncResult.Ok(
  PreviewData.Json({
    rendered: {
      $schema: 'https://vega.github.io/schema/a/b.json',
    },
  }),
)

const vegaResult = AsyncResult.Ok(
  PreviewData.Vega({
    spec: {
      $schema: 'https://vega.github.io/schema/a/b.json',
    },
  }),
)

const imgResult = AsyncResult.Ok(PreviewData.Image())

const pendingResult = AsyncResult.Pending()

describe('containers/Bucket/viewModes', () => {
  describe('useViewModes', () => {
    afterEach(() => {
      mocked(global.fetch).mockClear()
    })

    it('returns empty list when no modes', () => {
      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.md'),
      )
      expect(result.current).toMatchObject([])
    })

    it('returns Notebooks modes for .ipynb when no Voila service', async () => {
      mocked(global.fetch).mockImplementation(fetchNotOk)

      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.ipynb'),
      )
      expect(result.current).toMatchObject([
        { key: 'jupyter', label: 'Jupyter' },
        { key: 'json', label: 'JSON' },
      ])
    })

    it('returns Notebooks modes for .ipynb with Voila mode', async () => {
      mocked(global.fetch).mockImplementation(fetchOk)

      const { result, waitForNextUpdate } = renderHook(() =>
        useViewModes('https://registry.example', 'test.ipynb'),
      )
      await waitForNextUpdate()
      expect(result.current).toMatchObject([
        { key: 'jupyter', label: 'Jupyter' },
        { key: 'json', label: 'JSON' },
        { key: 'voila', label: 'Voila' },
      ])
    })

    it('returns no modes for .json when no Vega mode', async () => {
      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.json'),
      )
      expect(result.current).toMatchObject([])
    })

    it('returns no modes for .json when result is pending', async () => {
      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.json', pendingResult),
      )
      expect(result.current).toMatchObject([])
    })

    it('returns Vega/JSON modes for .json when Vega mode selected', async () => {
      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.json', vegaResult),
      )
      expect(result.current).toMatchObject([
        { key: 'vega', label: 'Vega' },
        { key: 'json', label: 'JSON' },
      ])
    })

    it('returns Vega/JSON modes for .json when JSON mode selected', async () => {
      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.json', jsonResult),
      )
      expect(result.current).toMatchObject([
        { key: 'vega', label: 'Vega' },
        { key: 'json', label: 'JSON' },
      ])
    })

    it('returns no modes for .json when result is different Preview', async () => {
      const { result } = renderHook(() =>
        useViewModes('https://registry.example', 'test.json', imgResult),
      )
      expect(result.current).toMatchObject([])
    })
  })
})
