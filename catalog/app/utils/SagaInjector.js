import invariant from 'invariant';
import set from 'lodash/fp/set';
import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import isSymbol from 'lodash/isSymbol';
import PT from 'prop-types';
import { Fragment } from 'react';
import {
  lifecycle,
  setPropTypes,
  withState,
  withHandlers,
  getContext,
  withContext,
} from 'recompose';

import {
  composeComponent,
  composeHOC,
  restoreProps,
  saveProps,
} from 'utils/reactTools';


const scope = 'app/utils/SagaInjector';

export const RESTART_ON_REMOUNT = Symbol(`${scope}/RESTART_ON_REMOUNT`);
export const DAEMON = Symbol(`${scope}/DAEMON`);
export const ONCE_TILL_UNMOUNT = Symbol(`${scope}/ONCE_TILL_UNMOUNT`);

export const MODES = { RESTART_ON_REMOUNT, DAEMON, ONCE_TILL_UNMOUNT };

const DONE = Symbol(`${scope}/DONE`);

const SagaInjectorShape = PT.shape({
  inject: PT.func.isRequired,
  eject: PT.func.isRequired,
});

const isValidKey = (key) => isString(key) && !isEmpty(key);

const isValidMode = (mode) => isSymbol(mode) && Object.values(MODES).includes(mode);

export const SagaInjector = composeComponent('SagaInjector',
  setPropTypes({
    run: PT.func.isRequired,
  }),
  saveProps({ keep: ['run'] }),
  withState('descriptors', 'setDescriptors', {}),
  withHandlers({
    inject: ({ descriptors, setDescriptors, run }) =>
      (key, { saga, mode = RESTART_ON_REMOUNT } = {}, ...args) => {
        const innerScope = `${scope}/SagaInjector/inject`;
        invariant(isValidKey(key),
          `${innerScope}: Expected 'key' to be a non-empty string`);
        invariant(isFunction(saga),
          `${innerScope}: Expected 'descriptor.saga' to be a function`);
        invariant(isValidMode(mode),
          `${innerScope}: Expected 'descriptor.mode' to be a valid saga run mode`);

        let hasSaga = key in descriptors;

        if (process.env.NODE_ENV !== 'production') {
          const oldDescriptor = descriptors[key];
          // enable hot reloading of daemon and once-till-unmount sagas
          if (oldDescriptor && oldDescriptor.saga !== saga) {
            oldDescriptor.task.cancel();
            hasSaga = false;
          }
        }

        if (!hasSaga || (hasSaga && mode === RESTART_ON_REMOUNT)) {
          setDescriptors(set(key, { saga, mode, task: run(saga, ...args) }));
        }
      },
    eject: ({ descriptors, setDescriptors }) => (key) => {
      const innerScope = `${scope}/SagaInjector/eject`;
      invariant(isValidKey(key),
        `${innerScope}: Expected 'key' to be a non-empty string`);

      const desc = descriptors[key];
      if (!desc || desc === DONE) return;

      if (desc.mode !== DAEMON) {
        desc.task.cancel();
        // Clean up in production; in development we need `descriptor.saga` for hot reloading
        if (process.env.NODE_ENV === 'production') {
          // Need some value to be able to detect `ONCE_TILL_UNMOUNT` sagas in `inject`
          setDescriptors(set(key, DONE));
        }
      }
    },
  }),
  withContext(
    { sagaInjector: SagaInjectorShape.isRequired },
    ({ inject, eject }) => ({ sagaInjector: { inject, eject } }),
  ),
  restoreProps(),
  Fragment);

const ownPropsKey = 'ownProps';

export const injectSaga = (key, saga, {
  mode,
  args = (props) => [props],
} = {}) =>
  composeHOC(`injectSaga(${key})`,
    saveProps({ key: ownPropsKey }),
    getContext({
      sagaInjector: SagaInjectorShape.isRequired,
    }),
    lifecycle({
      componentWillMount() {
        this.props.sagaInjector.inject(key, { saga, mode }, ...args(this.props[ownPropsKey]));
      },
      componentWillUnmount() {
        this.props.sagaInjector.eject(key);
      },
    }),
    restoreProps({ key: ownPropsKey }));
