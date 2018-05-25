import React from 'react';
import { connect } from 'react-redux';
import {
  lifecycle,
  withStateHandlers,
} from 'recompose';
import { createStructuredSelector } from 'reselect';

import Working from 'components/Working';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';

import { getCode } from './requests';
import * as selectors from './selectors';

export default composeComponent('Auth.Code',
  connect(createStructuredSelector({
    tokens: selectors.tokens,
  })),
  withStateHandlers({
    result: undefined,
  }, {
    setResult: () => (result) => ({ result }),
  }),
  lifecycle({
    componentWillMount() {
      getCode(this.props.tokens)
        .then(this.props.setResult)
        .catch((e) => {
          captureError(e);
          this.props.setResult(e);
        });
    },
  }),
  ({ result }) =>
    result
      ? (
        result instanceof Error
          ? <h1>error: {result}</h1>
          : <h1>code: {result}</h1>
      )
      : <Working>getting the code...</Working>);
