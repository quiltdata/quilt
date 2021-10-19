import React from 'react'

import * as Layout from './Layout'

const SUPPORT_EMAIL = 'support@quiltdata.io'

const Container = Layout.mkLayout('Activation Error')

export default function ActivationError() {
  return (
    <Container>
      <Layout.Message>
        <>
          Something went wrong during account activation. We&apos;re here to help. Email
          us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </>
      </Layout.Message>
    </Container>
  )
}
