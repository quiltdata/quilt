import * as React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

import * as BreadCrumbs from './'

describe('components/BreadCrumbs', () => {
  describe('Segment', () => {
    it('should render EMPTY', () => {
      const { container } = render(<BreadCrumbs.Segment />)
      expect(container).toMatchSnapshot()
    })
    it('should render label', () => {
      const { container } = render(<BreadCrumbs.Segment label="Lorem ipsum" />)
      expect(container).toMatchSnapshot()
    })
    it('should render link', () => {
      const { container } = render(
        <MemoryRouter>
          <BreadCrumbs.Segment label="A" to="/a" />
        </MemoryRouter>,
      )
      expect(container).toMatchSnapshot()
    })
  })
  describe('render', () => {
    it('basic breadcrumbs', () => {
      const crumbs = BreadCrumbs.getCrumbs('aa a/bb-b/c/d_d', (x) => x, 'ROOT')
      const { container } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs)}</MemoryRouter>,
      )
      expect(container).toMatchSnapshot()
    })
    it('and transform links', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT')
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const { container } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
      )
      expect(container).toMatchSnapshot()
    })
    it('and make links for every crumb', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT', { tailLink: true })
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const { container } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
      )
      expect(container).toMatchSnapshot()
    })
    it('and end with separator', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT', {
        tailLink: true,
        tailSeparator: true,
      })
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const { container } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
      )
      expect(container).toMatchSnapshot()
    })
    it('without root label', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b/c', (x) => x)
      const { container } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs)}</MemoryRouter>,
      )
      expect(container).toMatchSnapshot()
    })
  })
  it('copyWithoutSpaces', () => {
    const input = `ROOT / aa a
      / bb-b / c / <EMPTY> / d_d`
    expect(BreadCrumbs.trimSeparatorSpaces(input)).toBe('/aa a/bb-b/c//d_d')
  })
})
