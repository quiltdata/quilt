import * as React from 'react'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import * as Toolbar from './Toolbar'

vi.mock('./Assist', () => ({}))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
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

  afterEach(cleanup)

  describe('Add', () => {
    it('should render with default label', () => {
      const { getByText, queryByText } = render(
        <Toolbar.Add className="custom-class">Hello, Popover!</Toolbar.Add>,
      )
      expect(getByText('Add files')).toBeTruthy()
      expect(queryByText('Hello, Popover!')).toBeFalsy()
    })

    it('should render with custom label', () => {
      const { getByText, queryByText } = render(
        <Toolbar.Add label="Custom Add Label">Hello, Popover!</Toolbar.Add>,
      )
      expect(getByText('Custom Add Label')).toBeTruthy()
      expect(queryByText('Hello, Popover!')).toBeFalsy()
    })

    it('should render children when popover is opened', () => {
      const { getByText, getByRole } = render(<Toolbar.Add>Hello, Popover!</Toolbar.Add>)
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(getByText('Add files')).toBeTruthy()
      expect(getByText('Hello, Popover!')).toBeTruthy()
    })
  })

  describe('Get', () => {
    it('should render with default label', () => {
      const { getByText, queryByText } = render(
        <Toolbar.Get className="custom-class">Hello, Popover!</Toolbar.Get>,
      )
      expect(getByText('Get files')).toBeTruthy()
      expect(queryByText('Hello, Popover!')).toBeFalsy()
    })

    it('should render with custom label', () => {
      const { getByText, queryByText } = render(
        <Toolbar.Get label="Custom Get Label">Hello, Popover!</Toolbar.Get>,
      )
      expect(getByText('Custom Get Label')).toBeTruthy()
      expect(queryByText('Hello, Popover!')).toBeFalsy()
    })

    it('should render children when popover is opened', () => {
      const { getByText, getByRole } = render(<Toolbar.Get>Hello, Popover!</Toolbar.Get>)
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(getByText('Get files')).toBeTruthy()
      expect(getByText('Hello, Popover!')).toBeTruthy()
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
      const { getByText, queryByText } = render(
        <Toolbar.CreatePackage className="custom-class">
          Hello, Popover!
        </Toolbar.CreatePackage>,
      )
      expect(getByText('Create package')).toBeTruthy()
      expect(queryByText('Hello, Popover!')).toBeFalsy()
    })

    it('should render children when popover is opened', () => {
      const { getByText, getByRole } = render(
        <Toolbar.CreatePackage>Hello, Popover!</Toolbar.CreatePackage>,
      )
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(getByText('Create package')).toBeTruthy()
      expect(getByText('Hello, Popover!')).toBeTruthy()
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
      const { getByText, queryByText } = render(
        <Toolbar.Organize className="custom-class">Hello, Popover!</Toolbar.Organize>,
      )
      expect(getByText('Organize')).toBeTruthy()
      expect(getByText('5')).toBeTruthy() // Badge count
      expect(queryByText('Hello, Popover!')).toBeFalsy()
    })

    it('should render children when popover is opened', () => {
      const { getByText, getByRole } = render(
        <Toolbar.Organize>Hello, Popover!</Toolbar.Organize>,
      )
      const button = getByRole('button')
      act(() => {
        fireEvent.click(button)
      })
      expect(getByText('Organize')).toBeTruthy()
      expect(getByText('5')).toBeTruthy() // Badge count
      expect(getByText('Hello, Popover!')).toBeTruthy()
    })
  })
})
