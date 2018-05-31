import { red500 } from 'material-ui/styles/colors';
import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import PT from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import { mapProps, setPropTypes } from 'recompose';
import styled from 'styled-components';

import Spinner from 'components/Spinner';
import { composeComponent, withStyle } from 'utils/reactTools';

export const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  max-width: 280px;
  min-height: calc(100vh - 300px);
  width: 100%;
`;

export const Heading = styled.h1`
  text-align: center;
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

export const FieldErrorLink = styled(Link)`
  color: inherit !important;
  text-decoration: underline;
`;

export const Error = composeComponent('Auth.Error',
  withStyle`
    color: ${red500};
    margin-top: 24px;
    text-align: center;

    a {
      color: inherit !important;
      text-decoration: underline;
    }
  `,
  mapProps(({ submitFailed, error, errors, ...rest }) => ({
    error: submitFailed && error ? errors[error] || error : undefined,
    ...rest,
  })),
  ({ error, ...rest }) =>
    error ? <p {...rest}>{error}</p> : null);

export const Actions = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 32px;
`;

export const Hint = styled.p`
  font-size: 12px;
  line-height: 16px;
  margin-bottom: 12px;
  margin-top: 32px;
  text-align: center;

  & + & {
    margin-top: 12px;
  }
`;

export const Message = styled.p`
  text-align: center;
`;

// eslint-disable-next-line react/prop-types
export const mkLayout = (heading) => ({ children }) => (
  <Container>
    <Heading>{heading}</Heading>
    {children}
  </Container>
);

export const Submit = composeComponent('Auth.Submit',
  setPropTypes({
    busy: PT.bool,
  }),
  ({ busy, ...rest }) => (
    <RaisedButton
      type="submit"
      primary
      {...rest}
    >
      {busy && (
        <Spinner
          style={{
            fontSize: '1.5em',
            opacity: '.5',
            position: 'absolute',
            right: '-1.5em',
          }}
        />
      )}
    </RaisedButton>
  ));
