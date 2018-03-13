import invoke from 'lodash/fp/invoke';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import IconButton from 'material-ui/IconButton';
import PT from 'prop-types';
import React from 'react';
import { injectIntl } from 'react-intl';
import { compose, setPropTypes, setDisplayName } from 'recompose';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import Working from 'components/Working';
import api, { apiStatus } from 'constants/api';

import msg from './messages';
import ErrorMessage from './ErrorMessage';

const TitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const Title = compose(
  setPropTypes({
    onClose: PT.func.isRequired,
  }),
  setDisplayName('Admin.AuditDialog.Title'),
)(({ onClose, ...props }) => (
  <TitleContainer>
    <h3 {...props} />
    <IconButton
      style={{ width: '72px', height: '72px', padding: '24px' }}
      onClick={onClose}
    >
      <MIcon>close</MIcon>
    </IconButton>
  </TitleContainer>
));

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
    title={<Title onClose={onClose}>{title}</Title>}
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
      invoke(status, {
        [api.WAITING]: () => <Working />,
        [api.ERROR]: () => <ErrorMessage error={response} />,
        [api.SUCCESS]: () => <Component entries={response} />,
      })
    }
  </Dialog>
));
