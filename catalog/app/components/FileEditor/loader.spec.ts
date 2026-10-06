import { renderHook } from 'utils/renderHook'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { detect, isSupportedFileType, loadMode, useWriteData } from './loader'
import type { Mode } from './types'

const putObject = vi.fn(async () => ({ VersionId: 'bar' }))

const headObject = vi.fn(async () => ({ VersionId: 'foo', ContentLength: 999 }))

vi.mock('utils/AWS', () => ({
  S3: {
    use: vi.fn(() => ({
      putObject: () => ({
        promise: putObject,
      }),
      headObject: () => ({
        promise: headObject,
      }),
    })),
  },
}))

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('brace/mode/json', () => ({ default: Promise.resolve(undefined) }))

describe('components/FileEditor/loader', () => {
  describe('isSupportedFileType', () => {
    it('should return true for supported files', () => {
      expect(isSupportedFileType('file')).toBe(true)
      expect(isSupportedFileType('file.csv')).toBe(true)
      expect(isSupportedFileType('file.json')).toBe(true)
      expect(isSupportedFileType('file.md')).toBe(true)
      expect(isSupportedFileType('file.rmd')).toBe(true)
      expect(isSupportedFileType('file.txt')).toBe(true)
      expect(isSupportedFileType('file.yaml')).toBe(true)
      expect(isSupportedFileType('file.yml')).toBe(true)
    })
    it('should return false for unsupported files', () => {
      expect(isSupportedFileType('file.bam')).toBe(false)
      expect(isSupportedFileType('file.ipynb')).toBe(false)
      expect(isSupportedFileType('file.jpg')).toBe(false)
      expect(isSupportedFileType('file.wav')).toBe(false)
    })
    it('should detect supported files for nested directories or URLs', () => {
      expect(isSupportedFileType('directoryA/directoryB/file.txt')).toBe(true)
      expect(isSupportedFileType('../relative/file.txt')).toBe(true)
      expect(isSupportedFileType('https://example.com/path/file.txt')).toBe(true)
      expect(isSupportedFileType('s3://bucket/path/file.txt')).toBe(true)
      expect(isSupportedFileType('directoryA/directoryB/file.bam')).toBe(false)
      expect(isSupportedFileType('../relative/file.bam')).toBe(false)
      expect(isSupportedFileType('https://example.com/path/file.bam')).toBe(false)
      expect(isSupportedFileType('s3://bucket/path/file.bam')).toBe(false)
    })
  })

  describe('detect', () => {
    it('should detect quilt_summarize.json', () => {
      expect(detect('quilt_summarize.json').map((x) => x.brace)).toEqual([
        '__quiltSummarize',
        'json',
      ])
      expect(detect('nes/ted/quilt_summarize.json').map((x) => x.brace)).toEqual([
        '__quiltSummarize',
        'json',
      ])
    })
    it('should detect bucket preferences config', () => {
      expect(detect('.quilt/catalog/config.yml').map((x) => x.brace)).toEqual([
        '__bucketPreferences',
        'yaml',
      ])
      expect(detect('.quilt/catalog/config.yaml').map((x) => x.brace)).toEqual([
        '__bucketPreferences',
        'yaml',
      ])
      expect(
        detect('not/in/root/.quilt/catalog/config.yaml').map((x) => x.brace),
      ).toEqual(['yaml'])
    })
  })

  describe('useWriteData', () => {
    it('rejects when revision is outdated', () => {
      const { result } = renderHook(() =>
        useWriteData({ bucket: 'a', key: 'b', version: 'c' }),
      )
      return expect(result.current('any')).rejects.toThrow('Revision is outdated')
    })
    it('returns new version', () => {
      const { result } = renderHook(() =>
        useWriteData({ bucket: 'a', key: 'b', version: 'foo' }),
      )
      return expect(result.current('any')).resolves.toEqual({
        bucket: 'a',
        key: 'b',
        size: 999,
        version: 'bar',
      })
    })
  })

  describe('loadMode', () => {
    it('loads a mode before anything else has installed the ace global', async () => {
      // The SSO editor calls loadMode before its lazy TextEditor chunk imports brace.
      const { ace } = window as any
      onTestFinished(() => {
        vi.doUnmock('brace')
        vi.doUnmock('brace/mode/yaml')
        vi.resetModules()
        ;(window as any).ace = ace
      })
      delete (window as any).ace
      vi.resetModules()
      // Mirrors brace's contract: `brace` installs the `ace` global a mode reads as it evaluates.
      vi.doMock('brace', () => {
        ;(window as any).ace = { define: () => {} }
        return {}
      })
      vi.doMock('brace/mode/yaml', () => {
        ;(window as any).ace.define()
        return {}
      })
      const fresh = await import('./loader')
      let thrown: unknown
      try {
        fresh.loadMode('yaml')
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(Promise)
      await thrown
      expect(fresh.loadMode('yaml')).toBe('fulfilled')
    })

    it('throws on the first call and resolves on the second', async () => {
      let thrownPromise: Promise<void>
      try {
        loadMode('json')
        throw new Error('Expected loadMode to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(Promise)
        thrownPromise = error as Promise<void>
      }

      await thrownPromise
      expect(loadMode('json')).toBe('fulfilled')
    })

    it('throws the failure once a mode fails to load, not the rejected promise', async () => {
      // No such brace mode, so the import rejects the way a missing chunk does.
      const mode = 'no-such-mode' as Mode

      let thrown: unknown
      try {
        loadMode(mode)
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(Promise)
      await thrown

      thrown = undefined
      try {
        loadMode(mode)
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(Error)
    })
  })
})
