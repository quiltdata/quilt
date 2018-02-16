import FlatButton from 'material-ui/FlatButton';
import Snackbar from 'material-ui/Snackbar';
import TextField from 'material-ui/TextField';
import { red500 } from 'material-ui/styles/colors';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import {
  compose,
  setDisplayName,
  setPropTypes,
  withState,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import styled from 'styled-components';

import Spinner from 'components/Spinner';
import * as validators from 'utils/validators';

import messages from './messages';

const NOTIFICATION_TTL = 3000;

const FormField = compose(
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.shape({
      submitting: PT.bool,
      submitFailed: PT.bool,
      error: PT.string,
    }).isRequired,
    errors: PT.objectOf(PT.string),
  }),
  setDisplayName('Admin.AddMember.FormField'),
// eslint-disable-next object-curly-newline
)(({ input, meta, errors = {}, ...props }) => (
  <TextField
    {...input}
    {...props}
    disabled={meta.submitting}
    errorText={meta.submitFailed ? errors[meta.error] || meta.error : undefined}
  />
));

const Form = styled.form`
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
`;

const FormError = styled.p`
  color: ${red500};
  flex-basis: 100%;
  font-family: Roboto !important;
  font-size: .8em;
`;

const FORM_ERRORS = {
  uniq: 'The user with this username or email already exists',
  username: 'Username must start with a letter or underscore, and contain only alphanumeric characters and underscores thereafter',
};

export default compose(
  setPropTypes({
    addMember: PT.func.isRequired,
  }),
  withState('addedMember', 'setAddedMember'),
  reduxForm({
    form: 'Admin.AddMember',
    onSubmit: (values, _dispatch, { addMember }) =>
      new Promise((resolve, reject) => addMember(values.toJS(), { resolve, reject }))
        .catch((err) => {
          if (err.message === "Bad request. Maybe there's already a user with the username you provided?") {
            throw new SubmissionError({ _error: 'uniq' });
          }
          if (err.message === 'Please enter a valid email address.') {
            throw new SubmissionError({ email: 'email' });
          }
          if (/Username is not valid/.test(err.message)) {
            throw new SubmissionError({ username: 'username', _error: 'username' });
          }

          throw err;
        })
    ,
    onSubmitSuccess: (result, _dispatch, { reset, setAddedMember }) => {
      reset();
      setAddedMember(result);
    },
  }),
  setDisplayName('Admin.AddMember'),
)(({
  handleSubmit,
  error,
  pristine,
  invalid,
  submitting,
  submitFailed,
  addedMember,
  setAddedMember,
}) => (
  <Fragment>
    <h2><FormattedMessage {...messages.membersAdd} /></h2>
    <Form onSubmit={handleSubmit}>
      {error &&
        <FormError>{FORM_ERRORS[error] || error}</FormError>
      }
      <Field
        name="username"
        validate={[validators.required]}
        component={FormField}
        hintText="Username"
        errors={{
          required: 'Enter a username please',
          username: 'Enter a valid username please',
        }}
        style={{ marginRight: '12px' }}
      />
      <Field
        name="email"
        validate={[validators.required]}
        component={FormField}
        hintText="Email"
        errors={{
          required: 'Enter an email please',
          email: 'Enter a valid email please',
        }}
        style={{ marginRight: '12px' }}
      />
      <FlatButton
        type="submit"
        label="Add"
        labelPosition="before"
        icon={submitting ? <Spinner /> : null}
        disabled={submitting || pristine || submitFailed && invalid}
      />
    </Form>
    <Snackbar
      open={!!addedMember}
      message={addedMember
        ? `User ${addedMember.name} <${addedMember.email}> added successfully`
        : ''
      }
      autoHideDuration={NOTIFICATION_TTL}
      onRequestClose={() => setAddedMember(null)}
    />
  </Fragment>
));
