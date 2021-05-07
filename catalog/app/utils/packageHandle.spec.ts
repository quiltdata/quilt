import * as packageHandle from './packageHandle'

describe('utils/packageHandle', () => {
  describe('convertItem', () => {
    it('should return static string when no template', () => {
      expect(packageHandle.convertItem('fgsfds')).toBe('fgsfds')
      expect(packageHandle.convertItem('')).toBe('')
    })

    it('should treat broken template as a string and return this string', () => {
      expect(packageHandle.convertItem('start and <%= no end')).toBe(
        'start and <%= no end',
      )
    })

    it('should return converted when template has values', () => {
      expect(
        packageHandle.convertItem('what-<%=username %>-do/make-<%= directory %>-update', {
          directory: 'staging',
          username: 'fiskus',
        }),
      ).toBe('what-fiskus-do/make-staging-update')
      expect(
        packageHandle.convertItem('<%= username %>/<%= directory %>', {
          directory: 'staging',
          username: 'fiskus',
        }),
      ).toBe('fiskus/staging')
    })

    it('should return null when no values ', () => {
      expect(
        packageHandle.convertItem(
          'what-<%= username %>-do/make-<%= directory %>-update',
          { username: 'fiskus' },
        ),
      ).toBe(null)
      expect(
        packageHandle.convertItem('<%= username %>/<%= directory %>', {
          directory: 'staging',
        }),
      ).toBe(null)
    })

    it('should treat null/undefined as an empty string', () => {
      expect(
        packageHandle.convertItem(
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
        packageHandle.convert(
          { files: '<%= username %>/<%= directory %>', packages: 'abc/def' },
          'packages',
        ),
      ).toBe('abc/def')
      expect(
        packageHandle.convert(
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
        packageHandle.convert({ files: '<%= username %>/<%= directory %>' }, 'files', {
          username: 'fiskus',
        }),
      ).toBe('')
    })
  })
})
