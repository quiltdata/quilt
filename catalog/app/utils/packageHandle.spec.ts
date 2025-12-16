import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as packageHandle from './packageHandle'

describe('utils/packageHandle', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLog.mockRestore()
    consoleError.mockRestore()
  })

  describe('convertItem', () => {
    it('should return static string when no template', () => {
      expect(packageHandle.execTemplateItem('fgsfds')).toBe('fgsfds')
      expect(packageHandle.execTemplateItem('')).toBe('')
    })

    it('should treat broken template as a string and return this string', () => {
      expect(packageHandle.execTemplateItem('start and <%= no end')).toBe(
        'start and <%= no end',
      )
    })

    it('should return converted when template has values', () => {
      expect(
        packageHandle.execTemplateItem(
          'what-<%=username %>-do/make-<%= directory %>-update',
          {
            directory: 'staging',
            username: 'fiskus',
          },
        ),
      ).toBe('what-fiskus-do/make-staging-update')
      expect(
        packageHandle.execTemplateItem('<%= username %>/<%= directory %>', {
          directory: 'staging',
          username: 'fiskus',
        }),
      ).toBe('fiskus/staging')
    })

    it('should return null when no value for directory', () => {
      expect(
        packageHandle.execTemplateItem(
          'what-<%= username %>-do/make-<%= directory %>-update',
          {
            username: 'fiskus',
          },
        ),
      ).toBe(null)
      expect(consoleLog).toHaveBeenCalledWith(
        'Template for default package name is invalid',
      )
      expect(consoleError.mock.calls[0][0]).toMatchObject({
        message: 'directory is not defined',
      })
    })

    it('should return null when no value for username', () => {
      expect(
        packageHandle.execTemplateItem('<%= username %>/<%= directory %>', {
          directory: 'staging',
        }),
      ).toBe(null)
      expect(consoleLog).toHaveBeenCalledWith(
        'Template for default package name is invalid',
      )
      expect(consoleError.mock.calls[0][0]).toMatchObject({
        message: 'username is not defined',
      })
    })

    it('should treat null/undefined as an empty string', () => {
      expect(
        packageHandle.execTemplateItem(
          'what-<%= username %>-do/make-<%= directory %>-update',
          // @ts-expect-error
          { directory: undefined, username: null },
        ),
      ).toBe('what--do/make--update')
    })
  })

  describe('convert', () => {
    it('should use contexted replacement', () => {
      expect(
        packageHandle.execTemplate(
          { files: '<%= username %>/<%= directory %>', packages: 'abc/def' },
          'packages',
        ),
      ).toBe('abc/def')
      expect(
        packageHandle.execTemplate(
          { files: '<%= username %>/<%= directory %>', packages: '<%= a %>/<%= b %>' },
          'files',
          {
            username: 'fiskus',
            directory: 'staging',
          },
        ),
      ).toBe('fiskus/staging')
    })

    it('should return empty string if not enough values', () => {
      expect(
        packageHandle.execTemplate(
          { files: '<%= username %>/<%= directory %>' },
          'files',
          {
            username: 'fiskus',
          },
        ),
      ).toBe(null)
      expect(consoleLog).toHaveBeenCalledWith(
        'Template for default package name is invalid',
      )
      expect(consoleError.mock.calls[0][0]).toMatchObject({
        message: 'directory is not defined',
      })
    })
  })
})
