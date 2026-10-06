import * as React from 'react'

type ComponentWithProps = [
  React.ComponentType<React.PropsWithChildren<unknown>>,
  {} | undefined,
]
type ComponentOrComponentWithProps =
  | React.ComponentType<React.PropsWithChildren<unknown>>
  | ComponentWithProps
/**
 * Render nested components.
 *
 * @param components - React components or tuples of component and props.
 *
 * @returns The rendered nested components.
 */
export const nest = (...components: ComponentOrComponentWithProps[]) =>
  components.reduceRight(
    (children: React.ReactNode, comp: ComponentOrComponentWithProps) => {
      const [Component, props = {}]: ComponentWithProps = [].concat(comp as any) as any
      const actualProps = children ? { ...props, children } : props
      return <Component {...actualProps} />
    },
    undefined,
  ) as React.ReactElement

export const mkLazy = (
  importFunc: () => Promise<{
    default: React.ComponentType<React.PropsWithChildren<any>>
  }>,
  FallbackComp: React.FC<React.PropsWithChildren<unknown>>,
) => {
  const Component = React.lazy(importFunc)
  return (props = {}) => (
    <React.Suspense fallback={<FallbackComp />}>
      <Component {...props} />
    </React.Suspense>
  )
}
