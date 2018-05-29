import TextField from 'material-ui/TextField';
import PT from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import { mapProps, setPropTypes } from 'recompose';
import styled from 'styled-components';

import { composeComponent, withStyle } from 'utils/reactTools';

export const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  width: 400px;
`;

// TODO: styling
export const Heading = styled.h1`
`;

export const Field = composeComponent('Auth.Field',
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.object.isRequired,
    errors: PT.objectOf(PT.node),
  }),
  mapProps(({ input, meta, errors, ...rest }) => ({
    errorText:
      meta.submitFailed && meta.error
        ? errors[meta.error] || meta.error
        : undefined,
    fullWidth: true,
    ...input,
    ...rest,
  })),
  TextField);

export const Error = composeComponent('Auth.Error',
  // TODO: styling
  withStyle`
  `,
  mapProps(({ submitFailed, error, errors, ...rest }) => ({
    error: submitFailed && error ? errors[error] || error : undefined,
    ...rest,
  })),
  ({ error, ...rest }) =>
    error ? <p {...rest}>{error}</p> : null);

// TODO: styling
export const ErrorLink = styled(Link)`
`;

// TODO: styling
export const Actions = styled.div`
`;

// TODO: styling
export const Hint = styled.p`
`;

// TODO: styling
export const Message = styled.p`
`;

// eslint-disable-next-line react/prop-types
export const mkLayout = (heading) => ({ children }) => (
  <Container>
    <Heading>{heading}</Heading>
    {children}
  </Container>
);
