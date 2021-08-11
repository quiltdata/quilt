import React from 'react'

import { composeComponent } from 'utils/reactTools'

import * as Layout from './Layout'

const SUPPORT_EMAIL = 'support@quiltdata.io'

const Container = Layout.mkLayout('Activation Error')

export default composeComponent('Auth.ActivationError', () => (
  <Container>
    <Layout.Message>
      <>
        Something went wrong during account activation. We&apos;re here to help. Email us
        at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </>
    </Layout.Message>
  </Container>
))
