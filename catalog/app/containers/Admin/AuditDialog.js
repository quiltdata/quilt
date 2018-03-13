import invoke from 'lodash/fp/invoke';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import IconButton from 'material-ui/IconButton';
import PT from 'prop-types';
import React from 'react';
import { injectIntl } from 'react-intl';
import { lifecycle, setPropTypes, withHandlers } from 'recompose';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import Working from 'components/Working';
import api, { apiStatus } from 'constants/api';
import { composeComponent } from 'utils/reactTools';

import msg from './messages';
import ErrorMessage from './ErrorMessage';

const TitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const Title = composeComponent('Admin.AuditDialog.Title',
  setPropTypes({
    onClose: PT.func.isRequired,
  }),
  ({ onClose, ...props }) => (
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

export default composeComponent('Admin.AuditDialog',
  injectIntl,
  setPropTypes({
    id: PT.string,
    status: apiStatus,
    response: PT.any,
    title: PT.object.isRequired,
    component: PT.oneOfType([
      PT.func.isRequired,
      PT.instanceOf(React.Component),
    ]).isRequired,
    back: PT.string.isRequired,
    push: PT.func.isRequired,
    get: PT.func.isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.get(this.props.id);
    },
    componentWillReceiveProps({ id }) {
      if (id !== this.props.id) this.props.get(id);
    },
  }),
  withHandlers({
    close: ({ push, back }) => () => { push(back); },
  }),
  // eslint-disable-next-line no-shadow
  ({
    id,
    close,
    intl: { formatMessage },
    status,
    response,
    title,
    component: Component,
  }) => (
    <Dialog
      title={<Title onClose={close}>{`${formatMessage(title)}: ${id}`}</Title>}
      actions={[
        <FlatButton
          label={formatMessage(msg.closeAuditDialog)}
          primary
          onClick={close}
        />,
      ]}
      contentStyle={{ width: '80%', maxWidth: 'none' }}
      autoScrollBodyContent
      open={!!status}
      onRequestClose={close}
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
