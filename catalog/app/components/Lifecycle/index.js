import forIn from 'lodash/forIn';
import mapValues from 'lodash/mapValues';
import { Component } from 'react';
import PT from 'prop-types';

const hooks = {
  willMount: 'componentWillMount',
  didMount: 'componentDidMount',
  willReceiveProps: 'componentWillReceiveProps',
  willUpdate: 'componentWillUpdate',
  didUpdate: 'componentDidUpdate',
  willUnmount: 'componentWillUnmount',
};

// eslint-disable-next-line react/prefer-stateless-function
export default class Lifecycle extends Component {
  render() { return null; }
}

Lifecycle.propTypes = mapValues(hooks, () => PT.func);

forIn(hooks, (method, prop) => {
  // eslint-disable-next-line func-names
  Lifecycle.prototype[method] = function (...args) {
    const fn = this.props[prop];
    if (fn) fn(...args);
  };
});
