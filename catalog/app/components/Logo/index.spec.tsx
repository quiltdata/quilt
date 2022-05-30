import * as React from 'react'
import renderer from 'react-test-renderer'
import useMediaQuery from '@material-ui/core/useMediaQuery'

import Logo from '.'

const mockFn = jest.fn(useMediaQuery)

describe('components/Logo', () => {
  afterEach(() => {
    mockFn.mockClear()
  })

  it('should render squared logo', () => {
    const tree = renderer.create(<Logo height="20px" width="20px" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render rectangular logo', () => {
    const tree = renderer.create(<Logo height="30px" width="60px" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it.skip('should render custom logo', () => {
    // TODO: mock AWS.Signer
    const tree = renderer
      .create(<Logo src="https://example.com/example.png" height="10px" width="10px" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
