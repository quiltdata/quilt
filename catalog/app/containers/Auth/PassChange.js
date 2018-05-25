import get from 'lodash/fp/get';
import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  branch,
  mapProps,
  renderComponent,
  setPropTypes,
  withStateHandlers,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import Spinner from 'components/Spinner';
import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import * as validators from 'utils/validators';

import { passChange } from './actions';
import * as errors from './errors';
import msg from './messages';
import { authenticated } from './selectors';


const showError = (meta, errorMessages = {}) =>
  meta.submitFailed && meta.error
    ? errorMessages[meta.error] || meta.error
    : undefined;

const FormField = composeComponent('Auth.SignUp.Field',
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.object.isRequired,
    errors: PT.objectOf(PT.node),
  }),
  mapProps(({ input, meta, errors, ...rest }) => ({
    errorText: showError(meta, errors),
    ...input,
    ...rest,
  })),
  TextField);

const passwordsMatch = (field) => (v, vs) => {
  const pass = vs.get(field);
  return v && pass && v !== pass ? 'passMatch' : undefined;
};

const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  width: 400px;
`;

const passMatch = passwordsMatch('password');

export default composeComponent('Auth.PassChange',
  // TODO: what to show if user is authenticated
  //connect(createStructuredSelector({ authenticated })),
  withStateHandlers({
    done: false,
  }, {
    setDone: () => () => ({ done: true }),
  }),
  reduxForm({
    form: 'Auth.PassChange',
    onSubmit: async (values, dispatch, { setDone }) => {
      const link = 'sup'; // TODO: get the link from route params
      const result = defer();
      dispatch(passChange(link, values.toJS().password, result.resolver));
      try {
        await result.promise;
        setDone();
      } catch(e) {
        if (e instanceof errors.UserNotFound) {
          throw new SubmissionError({ _error: 'notFound' });
        }
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  // TODO: styling, copy
  branch(get('done'), renderComponent(({}) => (
    <h1>
      password changed successfully.
      <Link to="/signin">Sign in with your new password</Link>
    </h1>
  ))),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
      <form onSubmit={handleSubmit}>
        <h1><FM {...msg.passChangeHeading} /></h1>
        <Field
          component={FormField}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.passChangePassLabel} />}
          errors={{
            required: <FM {...msg.passChangePassRequired} />,
          }}
          fullWidth
        />
        <Field
          component={FormField}
          name="passwordCheck"
          type="password"
          validate={[validators.required, passMatch]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.passChangePassCheckLabel} />}
          errors={{
            required: <FM {...msg.passChangePassCheckRequired} />,
            passMatch: <FM {...msg.passChangePassCheckMatch} />,
          }}
          fullWidth
        />
        {/* TODO: style & copy */}
        {submitFailed && error && (
          <p>form error: {error}</p>
        )}
        {/* TODO: show spinner */}
        <RaisedButton
          type="submit"
          primary
          disabled={submitting || submitFailed && invalid}
          label={<FM {...msg.passChangeSubmit} />}
        />
      </form>
    </Container>
  ));
