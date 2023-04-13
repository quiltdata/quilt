import * as React from 'react'
import renderer from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'

import * as BreadCrumbs from './'

describe('components/BreadCrumbs', () => {
  describe('Segment', () => {
    it('should render EMPTY', () => {
      const tree = renderer.create(<BreadCrumbs.Segment />).toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('should render label', () => {
      const tree = renderer.create(<BreadCrumbs.Segment label="Lorem ipsum" />).toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('should render link', () => {
      const tree = renderer
        .create(
          <MemoryRouter>
            <BreadCrumbs.Segment label="A" to="/a" />
          </MemoryRouter>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
  describe('render', () => {
    it('basic breadcrumbs', () => {
      const crumbs = BreadCrumbs.getCrumbs('aa a/bb-b/c/d_d', (x) => x, 'ROOT')
      const tree = renderer
        .create(<MemoryRouter>{BreadCrumbs.render(crumbs)}</MemoryRouter>)
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('and transform links', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT')
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const tree = renderer
        .create(
          <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('and make links for every crumb', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT', { tailLink: true })
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const tree = renderer
        .create(
          <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('and end with separator', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT', {
        tailLink: true,
        tailSeparator: true,
      })
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const tree = renderer
        .create(
          <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
  test('copyWithoutSpaces', () => {
    const input = `ROOT / aa a
      / bb-b / c / <EMPTY> / d_d`
    expect(BreadCrumbs.trimSeparatorSpaces(input)).toBe('/aa a/bb-b/c//d_d')
  })
})
