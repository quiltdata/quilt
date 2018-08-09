import Button from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import { red500 } from 'material-ui/styles/colors';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage as FM, injectIntl } from 'react-intl';
import { setPropTypes } from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import styled from 'styled-components';

import { push } from 'containers/Notifications/actions';
import Spinner from 'components/Spinner';
import { composeComponent } from 'utils/reactTools';
import * as validators from 'utils/validators';

import msg from './messages';

const FormField = composeComponent('Admin.Members.Add.FormField',
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.shape({
      submitting: PT.bool,
      submitFailed: PT.bool,
      error: PT.string,
    }).isRequired,
    errors: PT.objectOf(PT.string),
  }),
  ({ input, meta, errors = {}, ...props }) => (
    <TextField
      {...input}
      {...props}
      disabled={meta.submitting}
      errorText={meta.submitFailed ? errors[meta.error] || meta.error : undefined}
    />
  ));

const Form = styled.form`
  align-items: center;
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
  uniq: msg.addFormErrorUniq,
  username: msg.addFormErrorUsername,
};

export default composeComponent('Admin.Members.Add',
  injectIntl,
  setPropTypes({
    add: PT.func.isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  reduxForm({
    form: 'Admin.Members.Add',
    onSubmit: (values, _dispatch, { add }) =>
      new Promise((resolve, reject) => add(values.toJS(), { resolve, reject }))
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
        }),
    // eslint-disable-next-line object-curly-newline
    onSubmitSuccess: ({ name, email }, dispatch, { reset, intl: { formatMessage } }) => {
      reset();
      dispatch(push(formatMessage(msg.addSuccess, { name, email })));
    },
  }),
  ({
    handleSubmit,
    error,
    pristine,
    invalid,
    submitting,
    submitFailed,
    intl: { formatMessage },
  }) => (
    <Fragment>
      <h3><FM {...msg.addHeading} /></h3>
      <Form onSubmit={handleSubmit}>
        {error && (
          <FormError>
            {error in FORM_ERRORS ? formatMessage(FORM_ERRORS[error]) : error}
          </FormError>
        )}
        <Field
          name="username"
          validate={[validators.required]}
          component={FormField}
          hintText={formatMessage(msg.addUsername)}
          errors={{
            required: formatMessage(msg.addUsernameRequired),
            username: formatMessage(msg.addUsernameInvalid),
          }}
          style={{ marginRight: '12px' }}
        />
        <Field
          name="email"
          validate={[validators.required]}
          component={FormField}
          hintText={formatMessage(msg.addEmail)}
          errors={{
            required: formatMessage(msg.addEmailRequired),
            email: formatMessage(msg.addEmailInvalid),
          }}
          style={{ marginRight: '12px' }}
        />
        <Button
          type="submit"
          label={formatMessage(msg.addSubmit)}
          disabled={submitting || pristine || (submitFailed && invalid)}
        />
        {submitting
          ? <Spinner style={{ fontSize: '2em', marginLeft: '12px', opacity: 0.5 }} />
          : null
        }
      </Form>
    </Fragment>
  ));
