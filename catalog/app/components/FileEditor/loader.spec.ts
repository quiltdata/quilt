import { renderHook } from '@testing-library/react-hooks'
import { vi } from 'vitest'

import { detect, isSupportedFileType, loadMode, useWriteData } from './loader'

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

vi.mock('constants/config', () => ({}))

vi.mock('brace/mode/json', () => Promise.resolve(undefined))

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
    it('throws on the first call and resolves on the second', () => {
      expect(() => loadMode('json')).toThrow()
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(loadMode('json')).toBe('fulfilled')
          resolve(null)
        })
      })
    })
  })
})
