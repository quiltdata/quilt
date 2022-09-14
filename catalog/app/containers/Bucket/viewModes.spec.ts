/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react-hooks'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import AsyncResult from 'utils/AsyncResult'
import * as voila from 'utils/voila'

import { useViewModes, viewModeToSelectOption } from './viewModes'

jest.mock('utils/voila')

const VEGA_SCHEMA = 'https://vega.github.io/schema/a/b.json'

const previewDataJsonPlain = PreviewData.Json({ rendered: { a: 1 } })
const previewDataJsonVega = PreviewData.Json({ rendered: { $schema: VEGA_SCHEMA } })
const previewDataVega = PreviewData.Vega({ spec: { $schema: VEGA_SCHEMA } })

const render = (...args: Parameters<typeof useViewModes>) =>
  renderHook(() => useViewModes(...args))

const packageHandle = { name: 'a', bucket: 'b', hash: 'c' }

describe('containers/Bucket/viewModes', () => {
  describe('viewModeToSelectOption', () => {
    it('returns null when given null', () => {
      expect(viewModeToSelectOption(null)).toBe(null)
    })
    it('returns propery formatted select option when given a view mode', () => {
      const opt = viewModeToSelectOption('json')
      expect(opt.toString()).toBe('JSON')
      expect(opt.valueOf()).toBe('json')
    })
  })

  describe('useViewModes', () => {
    describe('for files with no alternative view modes', () => {
      const path = 'test.md'

      it('returns empty mode list and null mode when given no mode input', () => {
        expect(render(path, null, packageHandle).result.current).toMatchObject({
          modes: [],
          mode: null,
        })
      })

      it('returns empty mode list and null mode when given any mode input', () => {
        expect(render(path, 'some-mode', packageHandle).result.current).toMatchObject({
          modes: [],
          mode: null,
        })
      })
    })

    describe('for Jupyter notebook files', () => {
      const path = 'test.ipynb'

      describe('when Voila is available', () => {
        beforeEach(() => {
          ;(voila as any).override(true)
        })

        afterEach(() => {
          ;(voila as any).reset()
        })

        it('returns Jupyter, JSON and Voila modes and defaults to Jupyter mode when no mode is given', () => {
          expect(render(path, null, packageHandle).result.current).toMatchObject({
            modes: ['jupyter', 'json', 'voila'],
            mode: 'jupyter',
          })
        })

        it('returns Jupyter, JSON and Voila modes and selected mode when correct mode is given', () => {
          expect(render(path, 'voila', packageHandle).result.current).toMatchObject({
            modes: ['jupyter', 'json', 'voila'],
            mode: 'voila',
          })
        })

        it('returns Jupyter, JSON and Voila modes and defaults to Jupyter mode when incorrect mode is given', () => {
          expect(render(path, 'bad', packageHandle).result.current).toMatchObject({
            modes: ['jupyter', 'json', 'voila'],
            mode: 'jupyter',
          })
        })

        it('returns Jupyter and JSON and Voila modes and defaults to Jupyter mode when package is not provided', () => {
          expect(render(path, 'voila').result.current).toMatchObject({
            modes: ['jupyter', 'json'],
            mode: 'jupyter',
          })
        })
      })

      describe('when Voila is unavailable', () => {
        it('returns Jupyter and JSON modes and defaults to Jupyter mode when no mode is given', () => {
          expect(render(path, null, packageHandle).result.current).toMatchObject({
            modes: ['jupyter', 'json'],
            mode: 'jupyter',
          })
        })
      })
    })

    describe('for JSON files', () => {
      const path = 'test.json'

      it('initially returns empty mode list and null mode when given any mode', () => {
        expect(render(path, 'vega', packageHandle).result.current).toMatchObject({
          modes: [],
          mode: null,
        })
      })

      it('ignores non-Ok results', () => {
        const { result } = render(path, null, packageHandle)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Pending())
        })
        expect(result.current).toMatchObject({ modes: [], mode: null })
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Err())
        })
        expect(result.current).toMatchObject({ modes: [], mode: null })
      })

      it('only sets result once', () => {
        const { result } = render(path, null, packageHandle)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(previewDataJsonVega))
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(previewDataJsonPlain))
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
      })

      it('returns Vega and JSON modes and defaults to Vega mode for Vega preview data', () => {
        const { result } = render(path, null, packageHandle)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(previewDataVega))
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
      })

      it('returns Vega and JSON modes and defaults to Vega mode for JSON preview data with vega schema', () => {
        const { result } = render(path, null, packageHandle)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(previewDataJsonVega))
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
      })

      it('returns empty mode list and null mode for JSON preview data without vega schema', () => {
        const { result } = render(path, null, packageHandle)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(previewDataJsonPlain))
        })
        expect(result.current).toMatchObject({ modes: [], mode: null })
      })

      it('returns empty mode list and null mode for other preview data', () => {
        const { result } = render(path, null, packageHandle)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(PreviewData.Image()))
        })
        expect(result.current).toMatchObject({ modes: [], mode: null })
      })
    })
  })
})
