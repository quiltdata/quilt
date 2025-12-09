import * as React from 'react'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { makeStyles } from 'utils/makeStyles.spec'

import * as Toolbar from './Toolbar'

vi.mock('./Assist', () => ({}))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  makeStyles: makeStyles('Toolbar'),
  IconButton: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
  Button: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
}))

const useSelection = vi.fn()
vi.mock('containers/Bucket/Selection/Provider', () => ({
  useSelection: () => useSelection(),
}))

describe('containers/Bucket/Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Add', () => {
    it('should render with default label', () => {
      const { container } = render(
        <Toolbar.Add className="custom-class">Hello, Popover!</Toolbar.Add>,
      )
      expect(container).toMatchSnapshot()
    })

    it('should render with custom label', () => {
      const { container } = render(
        <Toolbar.Add label="Custom Add Label">Hello, Popover!</Toolbar.Add>,
      )
      expect(container).toMatchSnapshot()
    })

    it('should render children when popover is opened', () => {
      const { container, getByRole } = render(<Toolbar.Add>Hello, Popover!</Toolbar.Add>)
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(container).toMatchSnapshot()
    })
  })

  describe('Get', () => {
    it('should render with default label', () => {
      const { container } = render(
        <Toolbar.Get className="custom-class">Hello, Popover!</Toolbar.Get>,
      )
      expect(container).toMatchSnapshot()
    })

    it('should render with custom label', () => {
      const { container } = render(
        <Toolbar.Get label="Custom Get Label">Hello, Popover!</Toolbar.Get>,
      )
      expect(container).toMatchSnapshot()
    })

    it('should render children when popover is opened', () => {
      const { container, getByRole } = render(<Toolbar.Get>Hello, Popover!</Toolbar.Get>)
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(container).toMatchSnapshot()
    })
  })

  describe('CreatePackage', () => {
    beforeEach(() => {
      useSelection.mockReturnValue({
        isEmpty: true,
        totalCount: 0,
        inited: true,
      })
    })

    it('should render with empty selection', () => {
      const { container } = render(
        <Toolbar.CreatePackage className="custom-class">
          Hello, Popover!
        </Toolbar.CreatePackage>,
      )
      expect(container).toMatchSnapshot()
    })

    it('should render children when popover is opened', () => {
      const { container, getByRole } = render(
        <Toolbar.CreatePackage>Hello, Popover!</Toolbar.CreatePackage>,
      )
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(container).toMatchSnapshot()
    })
  })

  describe('Organize', () => {
    beforeEach(() => {
      useSelection.mockReturnValue({
        isEmpty: false,
        totalCount: 5,
        inited: true,
      })
    })

    it('should render with selection items', () => {
      const { container } = render(
        <Toolbar.Organize className="custom-class">Hello, Popover!</Toolbar.Organize>,
      )
      expect(container).toMatchSnapshot()
    })

    it('should render children when popover is opened', () => {
      const { container, getByRole } = render(
        <Toolbar.Organize>Hello, Popover!</Toolbar.Organize>,
      )
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(container).toMatchSnapshot()
    })
  })
})
