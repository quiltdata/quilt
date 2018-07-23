import PT from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { defaultProps, setPropTypes, withProps } from 'recompose';

import { composeComponent } from 'utils/reactTools';
import { InjectReducer } from 'utils/ReducerInjector';

import * as actions from './actions';
import { REDUX_KEY } from './constants';
import reducer from './reducer';
import selector from './selectors';
import Notification from './Notification';


export const Provider = composeComponent('Notifications.Provider',
  withProps({ mount: REDUX_KEY, reducer }),
  InjectReducer);

export default composeComponent('Notifications',
  connect(selector, actions),
  setPropTypes({
    notifications: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        id: PT.string.isRequired,
        ttl: PT.number.isRequired,
        message: PT.node.isRequired,
        action: PT.shape({
          label: PT.string.isRequired,
          onClick: PT.func.isRequired,
        }),
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    dismiss: PT.func.isRequired,
    NotificationComponent: PT.oneOfType([
      PT.string,
      PT.func,
    ]),
  }),
  defaultProps({ NotificationComponent: Notification }),
  ({ NotificationComponent, notifications, dismiss }) =>
    notifications.map((n) =>
      <NotificationComponent key={n.id} {...n} dismiss={dismiss} />));
