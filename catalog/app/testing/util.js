import flow from 'lodash/flow';
import id from 'lodash/identity';
import kebabCase from 'lodash/kebabCase';
import omit from 'lodash/fp/omit';
import pick from 'lodash/fp/pick';
import pickBy from 'lodash/fp/pickBy';
import { createElement, Component } from 'react';

export const getLocation = ({ location: l }) =>
  `${l.pathname}${l.search}${l.hash}`;

export const getComponentName = (name) => `component-${kebabCase(name)}`;
export const getPropName = (name) => `prop-${kebabCase(name)}`;

/**
 * Get attributes from props.
 *
 * @param {Object} props
 *
 * @param {string[]|function} mapper
 *
 * @param {string[]|function} drop
 *
 * @returns {function} Attribute mapper.
 */
const getAttrs = (mapper, drop) => {
  if (typeof mapper === 'function') return mapper;
  return flow(
    drop instanceof Array && !mapper ? omit(drop) : id,
    mapper instanceof Array ? pick(mapper) : mapper || id,
  );
};

const defaultRenderChildren = ({ children }) => [children];

const renderChildren = (props) =>
  Object.entries(props).map(([key, value]) =>
    createElement(getPropName(key), {}, value));

/**
 * Get children from props.
 *
 * @param {Object} props
 *
 * @param {string[]|function} mapper
 *
 * @returns {react.Element[]} An array of react elements to use as children.
 */
const getChildren = (mapper) =>
  mapper instanceof Array
    ? flow(pick(mapper), pickBy(Boolean), renderChildren)
    : mapper || defaultRenderChildren;

/**
 * Create a mock component that renders as div.
 *
 * @param {Object} options
 *
 * @param {string} options.name
 *
 * @param {string[]|function} options.attrs
 *   If array of strings, pick these props and render them as resulting element's attributes.
 *   If function, call it with props and use returned object as resulting element's attributes.
 *   Renders all the props by default.
 *
 * @param {string[]|function} options.children
 *   If array of strings, pick these props and render them as nested elements, like this:
 *     <prop-${key}>{value}</prop-${key}>
 *   If function, call it with props and use returned array as resulting element's children.
 *   Renders children as they are by default.
 *
 * @returns {react.Component}
 */
export const mockComponent = (name, {
  attrs,
  children,
} = {}) => {
  const attrMapper = getAttrs(attrs, children);
  const childrenMapper = getChildren(children);
  const component = getComponentName(name);
  return (props) => createElement(component, attrMapper(props), ...childrenMapper(props));
};

export const mockComponentClass = (name, { methods = {}, ...opts }) => {
  const render = mockComponent(name, opts);

  class Mock extends Component {
    render() { return render(this.props); }
  }

  Object.assign(Mock.prototype, methods);

  return Mock;
};

export const mockComponentSelector = (name, prop) => {
  const componentSelector = `${getComponentName(name)}`;
  if (!prop) return componentSelector;
  return `${componentSelector} ${getPropName(prop)}`;
};

export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
