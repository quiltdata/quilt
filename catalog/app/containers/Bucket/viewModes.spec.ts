import { mocked } from 'ts-jest/utils'
import { renderHook } from '@testing-library/react-hooks'

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
  })
})
