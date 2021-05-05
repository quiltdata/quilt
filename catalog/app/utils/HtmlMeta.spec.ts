import * as HtmlMeta from './HtmlMeta'

describe('utils/HtmlMeta', () => {
  describe('getTitle', () => {
    it('returns base when no arguments', () => {
      expect(HtmlMeta.getTitle('Base title')).toBe('Base title')
    })

    it('returns base plus prefix when prefix is string', () => {
      expect(HtmlMeta.getTitle('Base title', 'Specific title')).toBe(
        'Specific title • Base title',
      )
    })

    it('returns base plus divided prefix when prefix is array of strings', () => {
      expect(
        HtmlMeta.getTitle('Base title', ['Specific title #1', 'Specific title #2']),
      ).toBe('Specific title #1 • Specific title #2 • Base title')
    })
  })
})
