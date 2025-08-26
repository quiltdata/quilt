import * as React from 'react'
import { render, fireEvent, act } from '@testing-library/react'

import Get from './Get'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
  Button: ({ className, children, onClick }: any) => (
    <button role="button" {...{ className, children, onClick }} />
  ),
}))

describe('containers/Bucket/Toolbar/Get', () => {
  it('should render with default label', () => {
    const { container } = render(<Get className="custom-class">Hello, Popover!</Get>)
    expect(container).toMatchSnapshot()
  })

  it('should render with custom label', () => {
    const { container } = render(<Get label="Custom Get Label">Hello, Popover!</Get>)
    expect(container).toMatchSnapshot()
  })

  it('should render children when popover is opened', () => {
    const { container, getByRole } = render(<Get>Hello, Popover!</Get>)
    const button = getByRole('button')
    act(() => {
      fireEvent.click(button)
    })
    expect(container).toMatchSnapshot()
  })
})
