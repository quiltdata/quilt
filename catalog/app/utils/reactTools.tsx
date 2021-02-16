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
// @ts-expect-error
const createFactory = RC.hoistStatics((Component: $TSFixMe) => (props: $TSFixMe) =>
  React.createElement(Component, props),
)

/**
 * Create a HOC that sets the displayName of a component
 * if it's possible and the name isn't already set.
 *
 * @param name
 *
 * @returns HOC setting the displayName to the given value
 */
const maybeSetDisplayName = (name: string) => (C: any) =>
  !C || typeof C === 'string' || typeof C === 'symbol' || C.displayName || C.name
    ? C
    : RC.setDisplayName(name)(C)

/**
 * Create a compound component from a set of HOCs (possibly empty) and a component.
 *
 * @param name - Display name of the resulting component.
 *
 * @param decorators - The set of HOCs to apply to the "render" component.
 *
 * @param render
 *   The leaf component that does the actual rendering.
 *   Usually a stateless functional component.
 *
 * @returns The resulting component with all the HOCs applied and displayName set.
 */
export const composeComponent = (name: string, ...args: $TSFixMe[]) => {
  const decorators = R.init(args)
  const render = R.last(args)
  return decorators.length
    ? RC.compose(
        RC.setDisplayName(name),
        createFactory,
        ...decorators,
        maybeSetDisplayName(`${name}:render`),
      )(render)
    : RC.setDisplayName(name)(render)
}

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
export const composeHOC = (name: string, ...decorators: $TSFixMe[]) => (
  Component: React.ComponentType,
) =>
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
  // @ts-expect-error
  composeHOC(`wrap(${RC.getDisplayName(Wrapper)})`, (Component) => (props) =>
    nest([Wrapper, propMapper(props)], [Component, props]),
  )

/**
 * Create a HOC that consumes a given context and injects it into props.
 *
 * @param context - React Context to consume
 *
 * @param propMapper
 *   When string, use it as a prop name to inject the context value to.
 *   When function, call it with the context value and props passed to the
 *   resulting component, and use the result as props passed to the decorated
 *   component.
 *
 * @returns Component receiving the context value via props
 *
 * @example
 * const ctx = createContext({ thing: 'value' });
 *
 * // the following calls are equivalent:
 * const withStuff = consume(ctx, 'stuff');
 * const withStuff2 = consume(ctx, (stuff, props) => ({ ...props, stuff });
 *
 * const Component = composeComponent('Component',
 *   withStuff,
 *   ({ stuff }) => <h1>{stuff.thing}</h1>);
 */
// @ts-expect-error
export const consume = ({ Consumer }, propMapper) => {
  const mkProps =
    typeof propMapper === 'string'
      ? // @ts-expect-error
        (value, props) => ({ ...props, [propMapper]: value })
      : propMapper
  // @ts-expect-error
  return (Component) => (props) => (
    // @ts-expect-error
    <Consumer>{(value) => <Component {...mkProps(value, props)} />}</Consumer>
  )
}

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
