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

  it('should render', () => {
    const tree = renderer.create(<Logo />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should be short when forcedShort', () => {
    const tree = renderer.create(<Logo forcedShort />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should be default in wide viewport', () => {
    const tree = renderer.create(<Logo responsive />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should be short in narrow viewport', () => {
    // NOTE: it means `xs === true`
    mocked(useMediaQuery).mockImplementation(() => true)
    const tree = renderer.create(<Logo responsive />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
