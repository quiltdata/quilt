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

// import Spinner from 'components/Spinner';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import validate, * as validators from 'utils/validators';

import * as errors from './errors';
import msg from './messages';
import { changePassword } from './requests';
// import { authenticated } from './selectors';
import * as Layout from './Layout';


const Container = Layout.mkLayout(<FM {...msg.passChangeHeading} />);

export default composeComponent('Auth.PassChange',
  // TODO: what to show if the user is authenticated
  // connect(createStructuredSelector({ authenticated })),
  withStateHandlers({
    done: false,
  }, {
    setDone: () => () => ({ done: true }),
  }),
  reduxForm({
    form: 'Auth.PassChange',
    onSubmit: async (values, dispatch, { setDone, match }) => {
      try {
        await changePassword(match.params.link, values.toJS().password);
        setDone();
      } catch (e) {
        if (e instanceof errors.InvalidResetLink) {
          throw new SubmissionError({ _error: 'invalid' });
        }
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  branch(get('done'), renderComponent(() => (
    <Container>
      <Layout.Message>
        <FM {...msg.passChangeSuccess} />
      </Layout.Message>
      <Layout.Message>
        <FM
          {...msg.passChangeSuccessCTA}
          values={{
            link: (
              <Link to="/signin">
                <FM {...msg.passChangeSuccessCTALink} />
              </Link>
            ),
          }}
        />
      </Layout.Message>
    </Container>
  ))),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
      <form onSubmit={handleSubmit}>
        <Field
          component={Layout.Field}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.passChangePassLabel} />}
          errors={{
            required: <FM {...msg.passChangePassRequired} />,
          }}
        />
        <Field
          component={Layout.Field}
          name="passwordCheck"
          type="password"
          validate={[
            validators.required,
            validate('check', validators.matchesField('password')),
          ]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.passChangePassCheckLabel} />}
          errors={{
            required: <FM {...msg.passChangePassCheckRequired} />,
            check: <FM {...msg.passChangePassCheckMatch} />,
          }}
          fullWidth
        />
        <Layout.Error
          {...{ submitFailed, error }}
          errors={{
            invalid: (
              <FM
                {...msg.passChangeErrorInvalid}
                values={{
                  link: (
                    <Layout.ErrorLink to="/reset_password">
                      <FM {...msg.passChangeErrorInvalidLink} />
                    </Layout.ErrorLink>
                  ),
                }}
              />
            ),
            unexpected: <FM {...msg.passChangeErrorUnexpected} />,
          }}
        />
        {/* TODO: show spinner */}
        <RaisedButton
          type="submit"
          primary
          disabled={submitting || (submitFailed && invalid)}
          label={<FM {...msg.passChangeSubmit} />}
        />
      </form>
    </Container>
  ));
