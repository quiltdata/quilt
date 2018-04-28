import initial from 'lodash/initial';
import last from 'lodash/last';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { createElement } from 'react';
import {
  compose,
  mapProps,
  setDisplayName,
  wrapDisplayName,
} from 'recompose';
import styled from 'styled-components';


const createFactory = (Component) => (props) => createElement(Component, props);

const maybeSetDisplayName = (name) => (C) =>
  !C || typeof C === 'string' || typeof C === 'symbol' || C.displayName || C.name
    ? C
    : setDisplayName(name)(C);

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

export const composeHOC = (name, ...decorators) => (Component) =>
  compose(
    setDisplayName(wrapDisplayName(Component, name)),
    createFactory,
    ...decorators,
  )(Component);

export const saveProps = ({ key = '_originalProps', keep = [] } = {}) =>
  composeHOC('saveProps',
    mapProps((props) => ({ ...pick(props, keep), [key]: omit(props, keep) })));

export const restoreProps = ({ key = '_originalProps', keep = [] } = {}) =>
  composeHOC('restoreProps',
    mapProps(({ [key]: original = {}, ...props }) =>
      ({ ...original, ...pick(props, keep) })));

export const withStyle = (...args) =>
  composeHOC('withStyle',
    (C) => styled(C)(...args));
