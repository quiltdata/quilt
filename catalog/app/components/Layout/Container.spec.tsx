import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { render, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { FullWidthProvider, Container, useSetFullWidth } from './Container'

const FallbackComponent = ({ error }: FallbackProps) => (
  <span>Error: {error?.message || 'Unexpected'}</span>
)

const EmptyContainer = () => (
  <ErrorBoundary {...{ FallbackComponent }}>
    <Container>{''}</Container>
  </ErrorBoundary>
)

describe('components/Layout/Container', () => {
  it('requires Provider', () => {
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
    const { container } = render(<EmptyContainer />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('has restricted width by default', () => {
    const { container } = render(
      <FullWidthProvider>
        <EmptyContainer />
      </FullWidthProvider>,
    )
    expect(container.firstChild).toMatchSnapshot()
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
    expect(container.firstChild).toMatchSnapshot()
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
    expect(container.firstChild).toMatchSnapshot()
  })
})
