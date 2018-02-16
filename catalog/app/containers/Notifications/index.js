import Snackbar from 'material-ui/Snackbar';
import PT from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import * as actions from './actions';
import selector from './selectors';


export default compose(
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
  }),
  setDisplayName('Notifications'),
)(({ notifications, dismiss }) =>
  // eslint-disable-next-line object-curly-newline
  notifications.map(({ id, ttl, message, action }) => (
    <Snackbar
      key={id}
      open
      message={message}
      action={action ? action.label : undefined}
      onActionClick={action ? action.onClick : undefined}
      autoHideDuration={ttl}
      onRequestClose={() => dismiss(id)}
    />
  )));
