import id from 'lodash/identity';
import pick from 'lodash/pick';
import { createElement } from 'react';
import { take } from 'redux-saga/effects';

export const getLocation = ({ location: l }) =>
  `${l.pathname}${l.search}${l.hash}`;

const mapProps = (props, mapper = id) =>
  mapper instanceof Array ? pick(props, mapper) : mapper(props);

const defaultRender = ({ children }) => [children];

const renderProps = (props) =>
  Object.entries(props).map(([key, value]) =>
    createElement('div', { __prop: key }, value));

const mapRender = (props, mapper = defaultRender) =>
  mapper instanceof Array ? renderProps(pick(props, mapper)) : mapper(props);

export const mockComponent = (name, propMapper, renderMapper) => (props) =>
  createElement(
    'div',
    { __name: name, ...mapProps(props, propMapper) },
    ...mapRender(props, renderMapper)
  );

export const findMockComponent = (html, name, prop) => {
  const comp = html.find(`[__name="${name}"]`);
  return prop
    ? comp.find(`[__prop="${prop}"]`)
    : comp;
};

export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

export const spyOnDispatch = (store) => {
  const dispatchSpy = jest.fn();
  store.runSaga(function* spyLoop() {
    while (true) dispatchSpy(yield take('*'));
  });
  return dispatchSpy;
};
