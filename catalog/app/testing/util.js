import id from 'lodash/identity';
import pick from 'lodash/pick';
import { createElement } from 'react';

export const getLocation = ({ location: l }) =>
  `${l.pathname}${l.search}${l.hash}`;

/**
 * Get attributes from props.
 *
 * @param {Object} props
 *
 * @param {string[]|function} mapper
 *
 * @returns {Object} Attribute map.
 */
const getAttrs = (props, mapper) =>
  mapper instanceof Array ? pick(props, mapper) : mapper(props);

const defaultRenderChildren = ({ children }) => [children];

const renderChildren = (props, el) =>
  Object.entries(props).map(([key, value]) =>
    createElement(el, { __prop: key }, value));

/**
 * Get children from props.
 *
 * @param {Object} props
 *
 * @param {string[]|function} mapper
 *
 * @param {react.Component} el React component for rendering elements.
 *
 * @returns {react.Element[]} An array of react elements to use as children.
 */
const getChildren = (props, mapper, el) =>
  mapper instanceof Array ? renderChildren(pick(props, mapper), el) : mapper(props);

/**
 * Create a mock component that renders as div.
 *
 * @param {Object} options
 *
 * @param {string} options.name
 *
 * @param {react.Component} options.el
 *   React component for rendering top-level element.
 *   Defaults to div.
 *
 * @param {react.Component} options.childEl
 *   React component for rendering nested elements.
 *   Defaults to div.
 *
 * @param {string[]|function} options.attrs
 *   If array of strings, pick these props and render them as resulting element's attributes.
 *   If function, call it with props and use returned object as resulting element's attributes.
 *   Renders all the props by default.
 *
 * @param {string[]|function} options.children
 *   If array of strings, pick these props and render them as nested elements, like this:
 *     <element __prop={key}>{value}</element>
 *   If function, call it with props and use returned array as resulting element's children.
 *   Renders children as they are by default.
 *
 * @returns {react.Component}
 */
export const mockComponent = (name, {
  el = 'div',
  childEl = 'div',
  attrs = id,
  children = defaultRenderChildren,
} = {}) => (props) =>
  createElement(el,
    { __name: name, ...getAttrs(props, attrs) },
    ...getChildren(props, children, childEl));

export const findMockComponent = (html, name, prop) => {
  const comp = html.find(`[__name="${name}"]`);
  return prop
    ? comp.find(`[__prop="${prop}"]`)
    : comp;
};

export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
