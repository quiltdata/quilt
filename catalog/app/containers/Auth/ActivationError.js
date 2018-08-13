// @flow

import React from 'react';
import { FormattedMessage as FM } from 'react-intl';

import { composeComponent } from 'utils/reactTools';

import msg from './messages';
import * as Layout from './Layout';

const SUPPORT_EMAIL = 'support@quiltdata.io';

const Container = Layout.mkLayout(<FM {...msg.activationErrorHeading} />);

export default composeComponent('Auth.ActivationError',
  () => (
    <Container>
      <Layout.Message>
        <FM
          {...msg.activationErrorMessage}
          values={{
            email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>,
          }}
        />
      </Layout.Message>
    </Container>
  ));
