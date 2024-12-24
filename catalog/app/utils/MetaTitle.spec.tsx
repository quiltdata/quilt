import * as React from 'react'
import { Helmet } from 'react-helmet'
import renderer from 'react-test-renderer'

import MetaTitle, { getTitle } from './MetaTitle'

describe('utils/HtmlMeta', () => {
  describe('HtmlMeta', () => {
    beforeAll(() => {
      Helmet.canUseDOM = false
    })

    afterAll(() => {
      Helmet.canUseDOM = true
    })

    it('should render base title', () => {
      renderer.create(<MetaTitle />)
      expect(Helmet.peek().title?.toString()).toBe(
        `<title data-react-helmet="true">Quilt is a versioned data hub for AWS</title>`,
      )
    })

    it('should render base title plus prefix title when prefix is string', () => {
      renderer.create(<MetaTitle>Specific title</MetaTitle>)
      expect(Helmet.peek().title?.toString()).toBe(
        `<title data-react-helmet="true">Specific title • Quilt is a versioned data hub for AWS</title>`,
      )
    })

    it('should render plus divided prefix titles when prefix is array of strings', () => {
      renderer.create(<MetaTitle>{['Specific title #1', 'Specific title #2']}</MetaTitle>)
      expect(Helmet.peek().title?.toString()).toBe(
        `<title data-react-helmet="true">Specific title #1 • Specific title #2 • Quilt is a versioned data hub for AWS</title>`,
      )
    })
  })

  describe('getTitle', () => {
    it('returns base when no arguments', () => {
      expect(getTitle('Base title')).toBe('Base title')
    })

    it('returns base plus prefix when prefix is string', () => {
      expect(getTitle('Base title', 'Specific title')).toBe('Specific title • Base title')
    })

    it('returns base plus divided prefix when prefix is array of strings', () => {
      expect(getTitle('Base title', ['Specific title #1', 'Specific title #2'])).toBe(
        'Specific title #1 • Specific title #2 • Base title',
      )
    })
  })
})
