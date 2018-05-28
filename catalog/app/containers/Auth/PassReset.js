import get from 'lodash/fp/get';
import RaisedButton from 'material-ui/RaisedButton';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
// import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  branch,
  renderComponent,
  withStateHandlers,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
// import { createStructuredSelector } from 'reselect';

// import Spinner from 'components/Spinner';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import * as validators from 'utils/validators';

import * as errors from './errors';
import msg from './messages';
import { resetPassword } from './requests';
// import { authenticated } from './selectors';
import * as Layout from './Layout';


const Container = Layout.mkLayout(<FM {...msg.passResetHeading} />);

// TODO: what to show if user is authenticated?
export default composeComponent('Auth.PassReset',
  // connect(createStructuredSelector({ authenticated })),
  withStateHandlers({
    done: false,
  }, {
    setDone: () => () => ({ done: true }),
  }),
  reduxForm({
    form: 'Auth.PassReset',
    onSubmit: async (values, dispatch, { setDone }) => {
      try {
        await resetPassword(values.toJS().email);
        setDone();
      } catch(e) {
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  branch(get('done'), renderComponent(({}) => (
    <Container>
      <Layout.Message>
        <FM {...msg.passResetSuccess} />
      </Layout.Message>
    </Container>
  ))),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
      <form onSubmit={handleSubmit}>
        <Field
          component={Layout.Field}
          name="email"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.passResetEmailLabel} />}
          errors={{
            required: <FM {...msg.passResetEmailRequired} />,
          }}
        />
        <Layout.Error
          {...{ submitFailed, error }}
          errors={{
            unexpected: <FM {...msg.passResetErrorUnexpected} />,
          }}
        />
        <Layout.Actions>
          {/* TODO: show spinner */}
          <RaisedButton
            type="submit"
            primary
            disabled={submitting || (submitFailed && invalid)}
            label={<FM {...msg.passResetSubmit} />}
          />
        </Layout.Actions>
        <Layout.Hint>
          <FM
            {...msg.passResetHintSignUp}
            values={{
              link: (
                <Link to="/signup">
                  <FM {...msg.passResetHintSignUpLink} />
                </Link>
              ),
            }}
          />
        </Layout.Hint>
      </form>
    </Container>
  ));
