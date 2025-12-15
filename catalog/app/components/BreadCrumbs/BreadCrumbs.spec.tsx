import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, afterEach } from 'vitest'

import * as BreadCrumbs from './'

describe('components/BreadCrumbs', () => {
  afterEach(cleanup)

  describe('Segment', () => {
    it('should render EMPTY', () => {
      const { getByText } = render(<BreadCrumbs.Segment />)
      expect(getByText('<EMPTY>').textContent).toBe('<EMPTY>')
    })

    it('should render label', () => {
      const { getByText } = render(<BreadCrumbs.Segment label="Lorem ipsum" />)
      expect(getByText('Lorem ipsum').textContent).toBe('Lorem ipsum')
    })

    it('should render link', () => {
      const { getByText } = render(
        <MemoryRouter>
          <BreadCrumbs.Segment label="A" to="/a" />
        </MemoryRouter>,
      )
      expect(getByText('A').getAttribute('href')).toBe('/a')
    })
  })

  describe('render', () => {
    it('basic breadcrumbs', () => {
      const crumbs = BreadCrumbs.getCrumbs('aa a/bb-b/c/d_d', (x) => x, 'ROOT')
      const { container, getByText } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs)}</MemoryRouter>,
      )
      expect(getByText('ROOT').getAttribute('to')).toBe('')
      expect(getByText('aa a').getAttribute('href')).toBe('/aa a/')
      expect(getByText('bb-b').getAttribute('href')).toBe('/aa a/bb-b/')
      expect(getByText('c').getAttribute('href')).toBe('/aa a/bb-b/c/')
      expect(container.textContent).toContain('d_d')
    })

    it('and transform links', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT')
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const { container, getByText } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
      )
      expect(getByText('ROOT').getAttribute('href')).toBe('https://quiltdata.com/')
      expect(getByText('a').getAttribute('href')).toBe('https://quiltdata.com/a/')
      expect(container.textContent).toContain('b')
    })

    it('and make links for every crumb', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT', { tailLink: true })
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const { getByText } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
      )
      expect(getByText('ROOT').getAttribute('href')).toBe('https://quiltdata.com/')
      expect(getByText('a').getAttribute('href')).toBe('https://quiltdata.com/a/')
      expect(getByText('b').getAttribute('href')).toBe('https://quiltdata.com/a/b')
    })

    it('and end with separator', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b', (x) => x, 'ROOT', {
        tailLink: true,
        tailSeparator: true,
      })
      const getLinkProps = ({ to }: { to?: string }) => ({
        href: `https://quiltdata.com/${to || ''}`,
      })
      const { container, getByText } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs, { getLinkProps })}</MemoryRouter>,
      )
      expect(getByText('ROOT').getAttribute('href')).toBe('https://quiltdata.com/')
      expect(getByText('a').getAttribute('href')).toBe('https://quiltdata.com/a/')
      expect(getByText('b').getAttribute('href')).toBe('https://quiltdata.com/a/b')
      expect(container.textContent).toBe('ROOT / a / b / ')
    })

    it('without root label', () => {
      const crumbs = BreadCrumbs.getCrumbs('a/b/c', (x) => x)
      const { getByText, queryByText } = render(
        <MemoryRouter>{BreadCrumbs.render(crumbs)}</MemoryRouter>,
      )
      expect(getByText('a').getAttribute('href')).toBe('/a/')
      expect(getByText('b').getAttribute('href')).toBe('/a/b/')
      expect(queryByText('ROOT')).toBeFalsy()
    })
  })

  it('copyWithoutSpaces', () => {
    const input = `ROOT / aa a
      / bb-b / c / <EMPTY> / d_d`
    expect(BreadCrumbs.trimSeparatorSpaces(input)).toBe('/aa a/bb-b/c//d_d')
  })
})
