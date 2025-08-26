import * as React from 'react'
import { render, fireEvent, act } from '@testing-library/react'

import Add from './Add'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
  Button: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
}))

describe('containers/Bucket/Toolbar/Add', () => {
  it('should render with default label', () => {
    const { container } = render(<Add className="custom-class">Hello, Popover!</Add>)
    expect(container).toMatchSnapshot()
  })

  it('should render with custom label', () => {
    const { container } = render(<Add label="Custom Add Label">Hello, Popover!</Add>)
    expect(container).toMatchSnapshot()
  })

  it('should render children when popover is opened', () => {
    const { container, getByRole } = render(<Add>Hello, Popover!</Add>)
    const button = getByRole('button')
    act(() => {
      fireEvent.click(button)
    })
    expect(container).toMatchSnapshot()
  })
})
