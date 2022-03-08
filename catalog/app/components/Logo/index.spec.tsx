import * as React from 'react'
import renderer from 'react-test-renderer'
import { mocked } from 'ts-jest/utils'
import useMediaQuery from '@material-ui/core/useMediaQuery'

import Logo from '.'

jest.mock('@material-ui/core/useMediaQuery')

describe('components/Logo', () => {
  afterEach(() => {
    mocked(useMediaQuery).mockClear()
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
    const tree = renderer
      .create(<Logo src="https://example.com/example.png" height="10px" width="10px" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
