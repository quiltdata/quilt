import * as React from 'react'
import { render } from 'react-dom'
import { act } from 'react-dom/test-utils'
import { mocked } from 'ts-jest/utils'

import global from 'utils/global'

import useViewModes, { ViewMode } from './viewModes'

jest.mock('utils/global')

const container = document.createElement('div')

function fetchOk(): Promise<Response> {
  return Promise.resolve({
    ok: true,
  } as Response)
  // return new Promise((resolve) => {
  //   console.log('FETCH OK INSIDE PROMISE')
  //   setTimeout(() => {
  //     console.log('TIMEOUT END')
  //     resolve({
  //       ok: true,
  //     } as Response)
  //   }, 100)
  // })
}

// function fetchNotOk(): Promise<Response> {
//   return new Promise((resolve) =>
//     setTimeout(() => {
//       resolve({
//         ok: false,
//       } as Response)
//     }, 100),
//   )
// }

function renderHook() {
  const viewModes: { current?: ViewMode[] } = {}

  function TestComponent({ path, registry }: { path: string; registry: string }) {
    viewModes.current = useViewModes(registry, path)
    return null
  }

  function renderer(registry: string, path: string) {
    act(() => {
      render(<TestComponent path={path} registry={registry} />, container)
    })
  }

  return {
    viewModes,
    renderer,
  }
}

describe('containers/Bucket/viewModes', () => {
  describe('useVoilaService', () => {
    it('returns empty list when no modes', () => {
      const { viewModes, renderer } = renderHook()
      renderer('https://registry.example', 'test.md')
      expect(viewModes.current).toMatchObject([])
    })

    describe('useVoilaService, no Voila service', () => {
      const { viewModes, renderer } = renderHook()
      it('returns Notebooks modes for .ipynb', () => {
        act(() => {
          mocked(global.fetch).mockImplementation(fetchOk)
          renderer('https://registry.example', 'test.ipynb')
        })
        expect(viewModes.current).toMatchObject([
          { key: 'json', label: 'JSON' },
          { key: 'jupyter', label: 'Jupyter' },
        ])
      })
    })
  })

  // it('two', () => {
  //   renderer('https://ya.ru', 'lalala.ipynb')
  //   expect(viewModes.current).toMatchObject([
  //     { key: 'json', label: 'JSON' },
  //     { key: 'jupyter', label: 'Jupyter' },
  //   ])
  // })
})
