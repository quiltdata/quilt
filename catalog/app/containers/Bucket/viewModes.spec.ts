/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react-hooks'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import FileType from 'components/Preview/loaders/fileType'
import AsyncResult from 'utils/AsyncResult'

import { useViewModes, viewModeToSelectOption } from './viewModes'

const VEGA_SCHEMA = 'https://vega.github.io/schema/a/b.json'

const previewDataJsonPlain = PreviewData.Json({ rendered: { a: 1 } })

const render = (...args: Parameters<typeof useViewModes>) =>
  renderHook(() => useViewModes(...args))

describe('containers/Bucket/viewModes', () => {
  describe('viewModeToSelectOption', () => {
    it('returns null when given null', () => {
      expect(viewModeToSelectOption(null)).toBe(null)
    })
    it('returns propery formatted select option when given a view mode', () => {
      const opt = viewModeToSelectOption(FileType.Json)
      expect(opt.toString()).toBe('JSON')
      expect(opt.valueOf()).toBe('json')
    })
  })

  describe('useViewModes', () => {
    describe('for files with no alternative view modes', () => {
      it('returns empty mode list and null mode when given no mode input', () => {
        expect(render(null).result.current).toMatchObject({
          modes: [],
          mode: null,
        })
      })

      it('returns empty mode list and null mode when given any mode input', () => {
        expect(render('some-mode').result.current).toMatchObject({
          modes: [],
          mode: null,
        })
      })
    })

    describe('for JSON files', () => {
      it('initially returns empty mode list and null mode when given any mode', () => {
        expect(render('vega').result.current).toMatchObject({
          modes: [],
          mode: null,
        })
      })

      it('ignores non-Ok results', () => {
        const { result } = render(null)
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
        const { result } = render(null)
        act(() => {
          result.current.handlePreviewResult(
            AsyncResult.Ok(
              PreviewData.Json({
                rendered: { $schema: VEGA_SCHEMA },
                modes: ['vega', 'json'],
              }),
            ),
          )
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(previewDataJsonPlain))
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
      })

      it('returns Vega and JSON modes and defaults to Vega mode for Vega preview data', () => {
        const { result } = render(null)
        act(() => {
          result.current.handlePreviewResult(
            AsyncResult.Ok(
              PreviewData.Vega({
                spec: { $schema: VEGA_SCHEMA },
                modes: ['vega', 'json'],
              }),
            ),
          )
        })
        expect(result.current).toMatchObject({ modes: ['vega', 'json'], mode: 'vega' })
      })

      it('returns empty mode list and null mode for JSON preview data without vega schema', () => {
        const { result } = render(null)
        act(() => {
          result.current.handlePreviewResult(
            AsyncResult.Ok(PreviewData.Json({ rendered: { a: 1 }, modes: [] })),
          )
        })
        expect(result.current).toMatchObject({ modes: [], mode: null })
      })

      it('returns empty mode list and null mode for other preview data', () => {
        const { result } = render(null)
        act(() => {
          result.current.handlePreviewResult(AsyncResult.Ok(PreviewData.Image()))
        })
        expect(result.current).toMatchObject({ modes: [], mode: null })
      })
    })
  })
})
