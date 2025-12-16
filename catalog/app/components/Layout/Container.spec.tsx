import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { render, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
}))

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
  afterEach(cleanup)

  it('requires Provider', () => {
    const errorHandler = vi.fn((event) => event.preventDefault())
    window.addEventListener('error', errorHandler)

    const { getByText } = render(<EmptyContainer />)

    expect(getByText('Error: Context must be used within a Provider')).toBeTruthy()

    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Context must be used within a Provider'),
        }),
      }),
    )

    window.removeEventListener('error', errorHandler)
  })

  it('has restricted width by default', () => {
    const { container } = render(
      <FullWidthProvider>
        <EmptyContainer />
      </FullWidthProvider>,
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('maxWidthLg')
    expect(element.className).not.toContain('fullWidth')
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
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('fullWidth')
    expect(element.className).not.toContain('maxWidthLg')
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
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('fullWidth')
    expect(element.className).not.toContain('maxWidthLg')
  })
})
