import * as React from 'react'
import { render, act } from '@testing-library/react'

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
    const { container } = render(<EmptyContainer />)
    expect(container).toMatchSnapshot()
  })

  it('has restricted width by default', () => {
    const { container } = render(
      <FullWidthProvider>
        <EmptyContainer />
      </FullWidthProvider>,
    )
    expect(container).toMatchSnapshot()
  })

  it('has full width once set', () => {
    const SetFullWidth = () => {
      useSetFullWidth()
      return <>long content</>
    }
    const { container } = render(
      <FullWidthProvider>
        <Container>
          <SetFullWidth />
        </Container>
      </FullWidthProvider>,
    )
    act(() => {})
    expect(container).toMatchSnapshot()
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
    const { container } = render(
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
    act(() => {})
    expect(container).toMatchSnapshot()
  })
})
