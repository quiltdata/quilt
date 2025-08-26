import * as React from 'react'
import { render, fireEvent, act } from '@testing-library/react'

import Organize from './Organize'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
  Button: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
}))

jest.mock('containers/Bucket/Selection/Provider', () => ({
  useSelection: jest.fn(() => ({
    isEmpty: false,
    totalCount: 5,
    inited: true,
  })),
}))

describe('containers/Bucket/Toolbar/Organize', () => {
  const mockOnReload = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render with selection items', () => {
    const { container } = render(
      <Organize onReload={mockOnReload} className="custom-class">
        Hello, Popover!
      </Organize>,
    )
    expect(container).toMatchSnapshot()
  })

  it('should render children when popover is opened', () => {
    const { container, getByRole } = render(
      <Organize onReload={mockOnReload}>Hello, Popover!</Organize>,
    )
    const button = getByRole('button')
    act(() => {
      fireEvent.click(button)
    })
    expect(container).toMatchSnapshot()
  })
})
