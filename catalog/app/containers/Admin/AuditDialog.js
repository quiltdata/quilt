import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import PT from 'prop-types';
import React from 'react';
import { injectIntl } from 'react-intl';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import Working from 'components/Working';
import api, { apiStatus } from 'constants/api';

import msg from './messages';
import { branch } from './util';
import ErrorMessage from './ErrorMessage';

export default compose(
  injectIntl,
  setPropTypes({
    onClose: PT.func.isRequired,
    status: apiStatus,
    response: PT.any,
    title: PT.node.isRequired,
    component: PT.oneOfType([
      PT.func.isRequired,
      PT.instanceOf(React.Component),
    ]).isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  setDisplayName('Admin.AuditDialog'),
)(({
  onClose,
  status,
  response,
  title,
  component: Component,
  intl: { formatMessage },
}) => (
  <Dialog
    title={title}
    actions={[
      <FlatButton
        label={formatMessage(msg.closeAuditDialog)}
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
