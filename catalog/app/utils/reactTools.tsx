import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'

// TODO: deprecate this
/**
 * Create a factory (function that renders a given component).
 *
 * @param Component
 *
 * @returns The factory function that "instantiates" the given component with the given props.
 *
 * @example
 * const Component = ({ children, cls }) => <h1 className={cls}>{children}</h1>;
 * const factory = createFactory(Component);
 *
 * // the following invocations are equivalent:
 * const res1 = factory({ children: 'sup', cls: 'hey' });
 * const res2 = <Component cls="hey">sup</Component>;
 */
const createFactory = RC.hoistStatics(
  // @ts-expect-error
  (Component: $TSFixMe) => (props: $TSFixMe) => React.createElement(Component, props),
)

/**
 * Create a compound HOC from a set of HOCs.
 *
 * @param name - The string used to wrap the decorated component.
 *
 * @param decorators - HOCs to compose.
 *
 * @returns
 *   The resulting HOC equivalent to application of all the decorators
 *   and wrapping the displayName with the given name.
 */
export const composeHOC =
  (name: string, ...decorators: $TSFixMe[]) =>
  (Component: React.ComponentType) =>
    RC.compose(
      RC.setDisplayName(RC.wrapDisplayName(Component, name)),
      createFactory,
      ...decorators,
      // @ts-expect-error
    )(Component)

type ComponentWithProps = [React.ComponentType, {} | undefined]
type ComponentOrComponentWithProps = React.ComponentType | ComponentWithProps
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

/**
 * Wrap component with another component.
 *
 * @param Wrapper - Wrapper component
 *
 * @param propMapper
 *   Prop mapper for the wrapper component. Default to identity, meaning
 *   that the wrapper component gets the same props as wrapped component.
 *
 * @returns Wrapped component
 */
// @ts-expect-error
export const wrap = (Wrapper, propMapper = R.identity) =>
  composeHOC(
    `wrap(${RC.getDisplayName(Wrapper)})`,
    // @ts-expect-error
    (Component) => (props) => nest([Wrapper, propMapper(props)], [Component, props]),
  )

/**
 * Wrap component into React.Suspense with given fallback and extra props.
 *
 * @param fallback - Function that renders fallback based on props.
 *
 * @param options - Extra props passed to React.Suspense.
 *
 * @returns Component wrapped into Suspense
 */
// @ts-expect-error
export const withSuspense = (fallback, opts) =>
  wrap(React.Suspense, (props) => ({ fallback: fallback(props), ...opts }))

/**
 * Create a lazy component.
 *
 * @param importFunc - Function that imports the component, e.g. `() => import('Component')`.
 *
 * @param options - All the options except for `fallback` are passed directly to Suspense.
 *
 * @param options.fallback
 *   Function for rendering fallback UI given props passed to the component.
 *   Result is passed to Suspense as `fallback` prop
 *   Renders `null` by default.
 *
 * @returns Lazy version of the component.
 *
 */
// @ts-expect-error
export const loadable = (importFunc, { fallback = () => null, ...opts }) =>
  withSuspense(fallback, opts)(React.lazy(importFunc))
