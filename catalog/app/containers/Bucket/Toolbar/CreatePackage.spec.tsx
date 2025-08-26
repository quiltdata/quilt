import * as React from 'react'
import { render, fireEvent, act } from '@testing-library/react'

import CreatePackage from './CreatePackage'

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
    isEmpty: true,
    totalCount: 0,
    inited: true,
  })),
}))

describe('containers/Bucket/Toolbar/CreatePackage', () => {
  it('should render with empty selection', () => {
    const { container } = render(
      <CreatePackage className="custom-class">Hello, Popover!</CreatePackage>,
    )
    expect(container).toMatchSnapshot()
  })

  it('should render children when popover is opened', () => {
    const { container, getByRole } = render(
      <CreatePackage>Hello, Popover!</CreatePackage>,
    )
    const button = getByRole('button')
    act(() => {
      fireEvent.click(button)
    })
    expect(container).toMatchSnapshot()
  })
})
