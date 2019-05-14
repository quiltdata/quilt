import flow from 'lodash/flow';
import id from 'lodash/identity';
import kebabCase from 'lodash/kebabCase';
import omit from 'lodash/fp/omit';
import pick from 'lodash/fp/pick';
import pickBy from 'lodash/fp/pickBy';
import { createElement, Component } from 'react';

/**
 * Get html-friendly name for component.
 *
 * @param {string} name
 *
 * @returns {string}
 */
export const getComponentName = (name) => `component-${kebabCase(name)}`;

/**
 * Get html-friendly name for nested prop.
 *
 * @param {string} name
 *
 * @returns {string}
 */
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
 * Create a mock stateless functional component that renders as a custom html element.
 *
 * @param {string} name
 *
 * @param {Object} options
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

/**
 * Create a mock class component that renders as a custom html element.
 * The same as `mockComponent`, but additionally accepts a method map that is
 * merged into prototype.
 *
 * @param {string} name
 *
 * @param {Object} options
 *
 * @param {Object} options.methods A map of methods to merge into prototype.
 *
 * @returns {react.Component}
 */
export const mockComponentClass = (name, { methods = {}, ...opts }) => {
  const render = mockComponent(name, opts);

  class Mock extends Component {
    render() { return render(this.props); }
  }

  Object.assign(Mock.prototype, methods);

  return Mock;
};

/**
 * Create a selector (suitable for enzyme or cheerio wrappers) that selects
 * a mock component created by `mockComponent[Class]` or its nested element / prop.
 *
 * @param {string} name Component name
 *
 * @param {string?} name Nested element / prop name
 *
 * @returns {string}
 */
export const mockComponentSelector = (name, prop) => {
  const componentSelector = `${getComponentName(name)}`;
  if (!prop) return componentSelector;
  return `${componentSelector} ${getPropName(prop)}`;
};

/**
 * Create a promise that is resolved via `setImmediate`.
 * Used to "wait for" all the promises that were recently fulfilled.
 *
 * @returns {Promise}
 */
export const flushPromises = () => new Promise((r) => setImmediate(r));
