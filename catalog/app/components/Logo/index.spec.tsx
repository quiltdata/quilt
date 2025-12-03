import * as React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { handleToS3Url } from 'utils/s3paths'

import Logo from '.'

vi.mock('utils/AWS', () => ({
  Signer: {
    useS3Signer: () => handleToS3Url,
  },
}))

describe('components/Logo', () => {
  it('should render squared logo', () => {
    const { container } = render(<Logo height="20px" width="20px" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render rectangular logo', () => {
    const { container } = render(<Logo height="30px" width="60px" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render custom logo', () => {
    // TODO: mock AWS.Signer
    const { container } = render(
      <Logo src="https://example.com/example.png" height="10px" width="10px" />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
