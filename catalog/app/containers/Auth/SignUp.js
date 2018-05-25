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

import { signUp } from './actions';
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

// TODO: memoize?
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

export default composeComponent('Auth.SignUp',
  connect(createStructuredSelector({ authenticated })),
  withStateHandlers({
    signedUp: false,
  }, {
    setSignedUp: () => () => ({ signedUp: true }),
  }),
  reduxForm({
    form: 'Auth.SignUp',
    onSubmit: async (values, dispatch) => {
      const result = defer();
      dispatch(signUp(values.remove('passwordCheck').toJS(), result.resolver));
      try {
        await result.promise;
      } catch(e) {
        // TODO: handle all the errors from the BE
        if (e instanceof errors.UsernameTaken) {
          throw new SubmissionError({ username: 'taken' });
        }
        if (e instanceof errors.InvalidUsername) {
          throw new SubmissionError({ username: 'invalid' });
        }
        if (e instanceof errors.EmailTaken) {
          throw new SubmissionError({ email: 'taken' });
        }
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
    onSubmitSuccess: (values, dispatch, { setSignedUp }) => {
      setSignedUp();
    },
  }),
  // TODO: styling, copy
  branch(get('authenticated'), renderComponent(({}) => (
    <h1>already signed in. sign out to register: btn</h1>
  ))),
  // TODO: styling, copy
  branch(get('signedUp'), renderComponent(({}) => (
    <h1>successfully signed up. check your email</h1>
  ))),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
      <form onSubmit={handleSubmit}>
        <h1><FM {...msg.signUpHeading} /></h1>
        <Field
          component={FormField}
          name="username"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signUpUsernameLabel} />}
          errors={{
            required: <FM {...msg.signUpUsernameRequired} />,
            taken: (
              <FM
                {...msg.signUpUsernameTaken}
                values={{
                  // TODO: proper reset link
                  link: <Link to="/reset"><FM {...msg.signUpPassResetHint} /></Link>,
                }}
              />
            ),
            invalid: <FM {...msg.signUpUsernameInvalid} />,
          }}
          fullWidth
        />
        <Field
          component={FormField}
          name="email"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signUpEmailLabel} />}
          errors={{
            required: <FM {...msg.signUpEmailRequired} />,
            taken: (
              <FM
                {...msg.signUpEmailTaken}
                values={{
                  // TODO: proper reset link
                  link: <Link to="/reset"><FM {...msg.signUpPassResetHint} /></Link>,
                }}
              />
            ),
          }}
          fullWidth
        />
        <Field
          component={FormField}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signUpPassLabel} />}
          errors={{
            required: <FM {...msg.signUpPassRequired} />,
          }}
          fullWidth
        />
        <Field
          component={FormField}
          name="passwordCheck"
          type="password"
          validate={[validators.required, passMatch]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signUpPassCheckLabel} />}
          errors={{
            required: <FM {...msg.signUpPassCheckRequired} />,
            passMatch: <FM {...msg.signUpPassCheckMatch} />,
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
          label={<FM {...msg.signUpSubmit} />}
        />
        {/* TODO: style & copy */}
        <p>Already have an account? <Link to="/signin">Sign In</Link>.</p>
      </form>
    </Container>
  ));
