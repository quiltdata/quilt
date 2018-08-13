// @flow

import RaisedButton from 'material-ui/RaisedButton';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import {
  branch,
  lifecycle,
  renderComponent,
  withHandlers,
  withStateHandlers,
} from 'recompose';
import styled from 'styled-components';

import Working from 'components/Working';
import copyToClipboard from 'utils/clipboard';
import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';

import { getCode } from './actions';
import msg from './messages';
import * as Layout from './Layout';

const Container = Layout.mkLayout(<FM {...msg.codeHeading} />);

const Code = styled.div`
  overflow-wrap: break-word;
`;

export default composeComponent('Auth.Code',
  connect(),
  withStateHandlers({
    result: null,
  }, {
    setResult: () => (result) => ({ result }),
  }),
  withHandlers({
    copy: ({ result }) => () => {
      copyToClipboard(result);
    },
  }),
  lifecycle({
    componentWillMount() {
      const result = defer();
      this.props.dispatch(getCode(result.resolver));
      result.promise
        .then(this.props.setResult)
        .catch((e) => {
          captureError(e);
          this.props.setResult(e);
        });
    },
  }),
  branch((p) => p.result instanceof Error, renderComponent(() => (
    <Container>
      <Layout.Message>
        <FM {...msg.codeError} />
      </Layout.Message>
    </Container>
  ))),
  branch((p) => p.result, renderComponent(({ result, copy }) => (
    <Container>
      <Code>{result}</Code>
      <Layout.Actions>
        <RaisedButton
          onClick={copy}
          label={<FM {...msg.codeCopy} />}
        />
      </Layout.Actions>
    </Container>
  ))),
  () => <Working><FM {...msg.codeWorking} /></Working>);
