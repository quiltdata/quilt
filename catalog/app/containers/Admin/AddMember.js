import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import {
  compose,
  setDisplayName,
  setPropTypes,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import styled from 'styled-components';

import * as validators from 'utils/validators';

import messages from './messages';

// TODO: proptypes
// eslint-disable-next obect-curly-newline
const renderField = ({ input, meta, errors = {}, ...props }) => (
  <TextField
    style={{ verticalAlign: 'top' }}
    {...input}
    {...props}
    disabled={meta.submitting}
    errorText={meta.submitFailed ? errors[meta.error] || meta.error : undefined}
  />
);

const Form = styled.form`
`;

// TODO: style
const FormError = styled.p`
`;

const FORM_ERRORS = {
  uniq: 'The user with this username or email already exists',
};

export default compose(
  setPropTypes({
    addMember: PT.func.isRequired,
  }),
  reduxForm({
    form: 'Admin.AddMember',
    onSubmit: (values, _dispatch, { addMember }) =>
      new Promise((resolve, reject) => addMember(values.toJS(), { resolve, reject }))
        .catch((err) => {
          if (err.message === "Bad request. Maybe there's already a user with the username you provided?") {
            throw new SubmissionError({ _error: 'uniq' });
          }
          throw err;
        })
        // TODO: reset form after success
    ,
  }),
  setDisplayName('Admin.AddMember'),
)(({
  handleSubmit,
  error,
  pristine,
  invalid,
  submitting,
  submitFailed,
}) => (
  <Fragment>
    <h2><FormattedMessage {...messages.membersAdd} /></h2>
    <Form onSubmit={handleSubmit}>
      {error &&
        <FormError>{FORM_ERRORS[error] || error}</FormError>
      }
      <Field
        name="username"
        validate={[validators.required, validators.username]}
        component={renderField}
        hintText="Username"
        errors={{
          required: 'Enter a username please',
          username: 'Enter a valid username please', // TODO: describe username format
        }}
      />
      <Field
        name="email"
        validate={[validators.required, validators.email]}
        component={renderField}
        hintText="Email"
        errors={{
          required: 'Enter an email please',
          email: 'Enter a valid email please',
        }}
      />
      <FlatButton
        label="Add"
        type="submit"
        disabled={submitting || pristine || submitFailed && invalid}
        style={{ verticalAlign: 'top' }}
      />
    </Form>
  </Fragment>
));
