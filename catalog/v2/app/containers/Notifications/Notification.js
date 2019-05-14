import Snackbar from 'material-ui/Snackbar';
import PT from 'prop-types';
import React from 'react';
import { setPropTypes } from 'recompose';

import { composeComponent } from 'utils/reactTools';

export default composeComponent('Notifications.Notification',
  setPropTypes({
    id: PT.string.isRequired,
    ttl: PT.number.isRequired,
    message: PT.node.isRequired,
    action: PT.shape({
      label: PT.string.isRequired,
      onClick: PT.func.isRequired,
    }),
    dismiss: PT.func.isRequired,
  }),
  ({ id, ttl, message, action, dismiss }) => (
    <Snackbar
      open
      message={message}
      action={action ? action.label : undefined}
      onActionClick={action ? action.onClick : undefined}
      autoHideDuration={ttl}
      onRequestClose={() => dismiss(id)}
    />
  ));
