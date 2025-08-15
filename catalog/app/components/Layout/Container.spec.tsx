import * as React from 'react'
import renderer from 'react-test-renderer'

import { createBoundary } from 'utils/ErrorBoundary'

import { FullWidthProvider, Container, useSetFullWidth } from './Container'

const ErrorBoundary = createBoundary(() => (error: Error) => (
  <span>Error: {error.message}</span>
))

const EmptyContainer = () => (
  <ErrorBoundary>
    <Container>{''}</Container>
  </ErrorBoundary>
)

describe('components/Layout/Container', () => {
  it('requires Provider', () => {
    jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
    const tree = renderer.create(<EmptyContainer />)
    expect(tree).toMatchSnapshot()
  })

  it('has restricted width by default', () => {
    const tree = renderer.create(
      <FullWidthProvider>
        <EmptyContainer />
      </FullWidthProvider>,
    )
    expect(tree.root.findByProps({ maxWidth: 'lg' })).toBeTruthy()
    expect(() => tree.root.findByProps({ maxWidth: false })).toThrow()
    expect(tree).toMatchSnapshot()
  })

  it('has full width once set', () => {
    const SetFullWidth = () => {
      useSetFullWidth()
      return <>long content</>
    }
    const tree = renderer.create(
      <FullWidthProvider>
        <Container>
          <SetFullWidth />
        </Container>
      </FullWidthProvider>,
    )
    renderer.act(() => {})
    expect(() => tree.root.findByProps({ maxWidth: 'lg' })).toThrow()
    expect(tree.root.findByProps({ maxWidth: false })).toBeTruthy()
    expect(tree).toMatchSnapshot()
  })

  it('still has full width when other remove full width', () => {
    // TODO: Show some warning or throw error:
    //       Some component is designed for narrow layout,
    //       but is rendered in `fullWidth`,
    //       because there are rendered other components designed for `fullWidth`.

    const SetFullWidth = () => {
      useSetFullWidth()
      return <>long content</>
    }
    const UnmountSetFullWidth = () => {
      const [x, setX] = React.useState(true)
      React.useEffect(() => {
        setX(false)
      }, [])
      return x ? <SetFullWidth /> : <>short content</>
    }
    const tree = renderer.create(
      <FullWidthProvider>
        <Container>
          <UnmountSetFullWidth />
          <SetFullWidth />
          <UnmountSetFullWidth />
          <SetFullWidth />
          <UnmountSetFullWidth />
        </Container>
      </FullWidthProvider>,
    )
    renderer.act(() => {})
    expect(() => tree.root.findByProps({ maxWidth: 'lg' })).toThrow()
    expect(tree.root.findByProps({ maxWidth: false })).toBeTruthy()
    expect(tree).toMatchSnapshot()
  })
})
