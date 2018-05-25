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

import { passReset } from './actions';
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

const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  width: 400px;
`;

// TODO: what to show if user is authenticated?
export default composeComponent('Auth.PassReset',
  //connect(createStructuredSelector({ authenticated })),
  withStateHandlers({
    done: false,
  }, {
    setDone: () => () => ({ done: true }),
  }),
  reduxForm({
    form: 'Auth.PassReset',
    onSubmit: async (values, dispatch, { setDone }) => {
      const result = defer();
      dispatch(passReset(values.toJS().email, result.resolver));
      try {
        await result.promise;
        setDone();
      } catch(e) {
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  // TODO: styling, copy
  branch(get('done'), renderComponent(({}) => (
    <h1>password reset request received. check your email</h1>
  ))),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
      <form onSubmit={handleSubmit}>
        <h1><FM {...msg.passResetHeading} /></h1>
        <Field
          component={FormField}
          name="email"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.passResetEmailLabel} />}
          errors={{
            required: <FM {...msg.passResetEmailRequired} />,
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
          label={<FM {...msg.passResetSubmit} />}
        />
        {/* TODO: style & copy */}
        <p>Don't have an account? <Link to="/signup">Sign Up</Link>.</p>
      </form>
    </Container>
  ));
