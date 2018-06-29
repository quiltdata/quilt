import initial from 'lodash/initial';
import last from 'lodash/last';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import React, { createElement } from 'react';
import {
  compose,
  mapProps,
  setDisplayName,
  wrapDisplayName,
} from 'recompose';
import styled from 'styled-components';


/**
 * Create a factory (function that renders a given component).
 *
 * @param {react.Component} Component
 *
 * @returns {function}
 *   The factory function that "instantiates" the given component with the given props.
 *
 * @example
 * const Component = ({ children, cls }) => <h1 className={cls}>{children}</h1>;
 * const factory = createFactory(Component);
 *
 * // the following invocations are equivalent:
 * const res1 = factory({ children: 'sup', cls: 'hey' });
 * const res2 = <Component cls="hey">sup</Component>;
 */
const createFactory = (Component) => (props) => createElement(Component, props);

/**
 * React Higher-Order Component: given a react component as an argument,
 * it returns a decorated version of that component.
 *
 * @typedef {function} HOC
 *
 * @param {react.Component} Component
 *
 * @returns {react.Component}
 *   Decorated version of the component.
 */

/**
 * Create a HOC that sets the displayName of a component
 * if it's possible and the name isn't already set.
 *
 * @param {string} name
 *
 * @returns {HOC}
 */
const maybeSetDisplayName = (name) => (C) =>
  !C || typeof C === 'string' || typeof C === 'symbol' || C.displayName || C.name
    ? C
    : setDisplayName(name)(C);

/**
 * Create a compound component from a set of HOCs (possibly empty) and a component.
 *
 * @param {string} name
 *   Display name of the resulting component.
 *
 * @param {...HOC} decorators
 *   The set of HOCs to apply to the "render" component.
 *
 * @param {react.Component} render
 *   The leaf component that does the actual rendering.
 *   Usually a stateless functional component.
 *
 * @returns {react.Component}
 *   The resulting component with all the HOCs applied and displayName set.
 */
export const composeComponent = (name, ...args) => {
  const decorators = initial(args);
  const render = last(args);
  return decorators.length
    ? compose(
      setDisplayName(name),
      createFactory,
      ...decorators,
      maybeSetDisplayName(`${name}:render`),
    )(render)
    : setDisplayName(name)(render);
};

/**
 * Create a compound HOC from a set of HOCs.
 *
 * @param {string} name
 *   The string used to wrap the decorated component.
 *
 * @param {...HOC} decorators
 *   HOCs to compose.
 *
 * @returns {HOC}
 *   The resulting HOC equivalent to application of all the decorators
 *   and wrapping the displayName with the given name.
 */
export const composeHOC = (name, ...decorators) => (Component) =>
  compose(
    setDisplayName(wrapDisplayName(Component, name)),
    createFactory,
    ...decorators,
  )(Component);

const DEFAULT_SAVED_PROPS_KEY = '@@app/utils/reactTools/originalProps';

/**
 * Create a HOC that saves the props passed to the resulting component
 * under a given key and passes only the kept props to the decorated component.
 *
 * @param {Object} options
 *
 * @param {string} options.key
 *   A key under which to store the original props.
 *   Pass something meaningful if you are planning to use it in your code.
 *
 * @param {string[]} options.keep
 *   A list of props to keep in the top-level props object.
 *   Defaults to an empty list (all the props are saved).
 *
 * @returns {HOC}
 */
export const saveProps = ({ key = DEFAULT_SAVED_PROPS_KEY, keep = [] } = {}) =>
  composeHOC('saveProps',
    mapProps((props) => ({ ...pick(props, keep), [key]: omit(props, keep) })));

/**
 * Create a HOC that restores the props saved by `saveProps()` HOC.
 *
 * @param {Object} options
 *
 * @param {string} options.key
 *   A key from which to get the saved props.
 *
 * @param {string[]} options.keep
 *   A list of props to keep (they won't be overwritten with the saved props
 *   in case of conflict).
 *   Defaults to an empty list (use only saved props, discard the passed props).
 *
 * @returns {HOC}
 */
export const restoreProps = ({ key = DEFAULT_SAVED_PROPS_KEY, keep = [] } = {}) =>
  composeHOC('restoreProps',
    mapProps(({ [key]: original, ...props }) =>
      ({ ...original, ...pick(props, keep) })));

/**
 * A composition-friendly interface for styled-components decorator.
 *
 * @example
 * const styledComponent = withStyle`
 *   color: #f00;
 * `(Component);
 *
 * // equivalent to:
 * const styledComponent = styled(Component)`
 *   color: #f00;
 * `;
 *
 * // composition friendliness:
 * const ComplexComponent = composeComponent('ComplexComponent',
 *   someHOC,
 *   withStyle`
 *     color: #f00;
 *   `,
 *   someOtherHOC,
 *   Component);
 *
 * @returns {HOC}
 */
export const withStyle = (...args) =>
  composeHOC('withStyle',
    (C) => styled(C)(...args));

/**
 * Shorthand for creating context providers.
 *
 * @param {Object} context
 * @param {react.ContextProvider} context.Provider
 *
 * @param {string|function} getValue
 *   When string, use it as a prop name to get the value from.
 *   When function, call it with the props to get the value.
 */
export const provide = ({ Provider }, getValue) =>
  mapProps((props) => ({
    children: props.children,
    value: typeof getValue === 'string' ? props[getValue] : getValue(props),
  }))(Provider);

/**
 * Create a HOC that consumes a given context and injects it into props.
 *
 * @param {Object} context
 * @param {react.ContextConsumer} context.Consumer
 *
 * @param {string|function} propMapper
 *   When string, use it as a prop name to inject the context value to.
 *   When function, call it with the context value and props passed to the
 *   resulting component, and use the result as props passed to the decorated
 *   component.
 *
 * @returns {HOC}
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
export const consume = ({ Consumer }, propMapper) => {
  const mkProps = typeof propMapper === 'string'
    ? (value, props) => ({ ...props, [propMapper]: value })
    : propMapper;
  return (Component) => (props) =>
    <Consumer>{(value) => <Component {...mkProps(value, props)} />}</Consumer>;
};
