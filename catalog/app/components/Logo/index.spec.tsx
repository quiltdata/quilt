import * as React from 'react'
import renderer from 'react-test-renderer'
import { handleToS3Url } from 'utils/s3paths'

import Logo from '.'

jest.mock('utils/AWS', () => ({
  Signer: {
    useS3Signer: () => handleToS3Url,
  },
}))

describe('components/Logo', () => {
  it('should render squared logo', () => {
    const tree = renderer.create(<Logo height="20px" width="20px" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render rectangular logo', () => {
    const tree = renderer.create(<Logo height="30px" width="60px" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render custom logo', () => {
    // TODO: mock AWS.Signer
    const tree = renderer
      .create(<Logo src="https://example.com/example.png" height="10px" width="10px" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
