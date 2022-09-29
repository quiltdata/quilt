import { isSupportedFileType } from './loader'

describe('components/FileEditor/loader', () => {
  describe('isSupportedFileType', () => {
    it('should return true for supported files', () => {
      expect(isSupportedFileType('file')).toBe(true)
      expect(isSupportedFileType('file.json')).toBe(true)
      expect(isSupportedFileType('file.md')).toBe(true)
      expect(isSupportedFileType('file.rmd')).toBe(true)
      expect(isSupportedFileType('file.txt')).toBe(true)
      expect(isSupportedFileType('file.yaml')).toBe(true)
      expect(isSupportedFileType('file.yml')).toBe(true)
    })
    it('should return false for unsupported files', () => {
      expect(isSupportedFileType('file.bam')).toBe(false)
      expect(isSupportedFileType('file.csv')).toBe(false)
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
})
