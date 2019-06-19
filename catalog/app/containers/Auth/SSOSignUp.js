import * as React from 'react'
// import { FormattedMessage as FM } from 'react-intl'
// import { branch, renderComponent, withStateHandlers } from 'recompose'
// import { reduxForm, Field, SubmissionError } from 'redux-form/immutable'

// import * as NamedRoutes from 'utils/NamedRoutes'
// import * as Sentry from 'utils/Sentry'
// import Link from 'utils/StyledLink'
// import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
// import { composeComponent } from 'utils/reactTools'
// import validate, * as validators from 'utils/validators'

// import { signUp } from './actions'
// import * as errors from './errors'
// import msg from './messages'
import * as Layout from './Layout'

const Container = Layout.mkLayout(({ provider }) => `Complete sign-up with ${provider}`)

export default ({ location: { search } }) => {
  const q = parseSearch(search)
  console.log('sso signup', q)
  return <Container provider={q.provider}>sso signup TBD</Container>
}
