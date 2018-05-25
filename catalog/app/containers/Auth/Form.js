import TextField from 'material-ui/TextField';
import PT from 'prop-types';
import React from 'react';
import { mapProps, setPropTypes } from 'recompose';
import styled from 'styled-components';

import { composeComponent, withStyle } from 'utils/reactTools';

const showError = (submitFailed, error, errors = {}) =>
  submitFailed && error
    ? errors[error] || error
    : undefined;

export const Field = composeComponent('Auth.Form.Field',
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.object.isRequired,
    errors: PT.objectOf(PT.node),
  }),
  mapProps(({ input, meta, errors, ...rest }) => ({
    errorText: showError(meta.submitFailed, meta.error, errors),
    fullWidth: true,
    ...input,
    ...rest,
  })),
  TextField);

export const Error = composeComponent('Auth.Form.Error',
  // TODO: styling
  withStyle`
  `,
  mapProps(({ submitFailed, error, errors, ...rest }) => ({
    error: showError(submitFailed, error, errors),
    ...rest,
  })),
  ({ error, ...rest }) =>
    error ? <p {...rest}>{error}</p> : null);

export const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  width: 400px;
`;

// TODO: styling
export const Heading = styled.h1`
`;
