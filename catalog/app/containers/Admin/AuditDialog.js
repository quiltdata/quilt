import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import PT from 'prop-types';
import React from 'react';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import Working from 'components/Working';
import api, { apiStatus } from 'constants/api';

import { branch } from './util';
import ErrorMessage from './ErrorMessage';

export default compose(
  setPropTypes({
    onClose: PT.func.isRequired,
    status: apiStatus,
    response: PT.any,
    title: PT.string.isRequired,
    component: PT.oneOfType([
      PT.func.isRequired,
      PT.instanceOf(React.Component),
    ]).isRequired,
  }),
  setDisplayName('Admin.AuditDialog'),
// eslint-disable-next-line object-curly-newline
)(({ onClose, status, response, title, component: Component }) => (
  <Dialog
    title={title}
    actions={[
      <FlatButton
        label="Close"
        primary
        onClick={onClose}
      />,
    ]}
    contentStyle={{ width: '80%', maxWidth: 'none' }}
    autoScrollBodyContent
    open={!!status}
    onRequestClose={onClose}
  >
    {
      branch(status, {
        [api.WAITING]: () => <Working />,
        [api.ERROR]: () => <ErrorMessage error={response} />,
        [api.SUCCESS]: () => <Component entries={response} />,
      })
    }
  </Dialog>
));
