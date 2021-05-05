import * as React from 'react'
import renderer from 'react-test-renderer'

import * as MetaTitle from './MetaTitle'

describe('utils/HtmlMeta', () => {
  describe('HtmlMeta', () => {
    it('should render base title', () => {
      const tree = renderer.create(<MetaTitle.HtmlMetaTitle />).toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render base title plus prefix title when prefix is string', () => {
      const tree = renderer
        .create(<MetaTitle.HtmlMetaTitle>Specific title</MetaTitle.HtmlMetaTitle>)
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render plus divided prefix titles when prefix is array of strings', () => {
      const tree = renderer
        .create(
          <MetaTitle.HtmlMetaTitle>
            {['Specific title #1', 'Specific title #2']}
          </MetaTitle.HtmlMetaTitle>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })

  describe('getTitle', () => {
    it('returns base when no arguments', () => {
      expect(MetaTitle.getTitle('Base title')).toBe('Base title')
    })

    it('returns base plus prefix when prefix is string', () => {
      expect(MetaTitle.getTitle('Base title', 'Specific title')).toBe(
        'Specific title • Base title',
      )
    })

    it('returns base plus divided prefix when prefix is array of strings', () => {
      expect(
        MetaTitle.getTitle('Base title', ['Specific title #1', 'Specific title #2']),
      ).toBe('Specific title #1 • Specific title #2 • Base title')
    })
  })
})
