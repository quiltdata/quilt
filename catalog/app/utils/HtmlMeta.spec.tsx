import * as React from 'react'
import renderer from 'react-test-renderer'

import * as HtmlMeta from './HtmlMeta'

describe('utils/HtmlMeta', () => {
  describe('HtmlMeta', () => {
    it('should render base title', () => {
      const tree = renderer.create(<HtmlMeta.Meta />).toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render base title plus prefix title when prefix is string', () => {
      const tree = renderer.create(<HtmlMeta.Meta>Specific title</HtmlMeta.Meta>).toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render plus divided prefix titles when prefix is array of strings', () => {
      const tree = renderer
        .create(
          <HtmlMeta.Meta>{['Specific title #1', 'Specific title #2']}</HtmlMeta.Meta>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })

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
