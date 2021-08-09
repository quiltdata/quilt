import * as React from 'react'
import { connect } from 'react-redux'
import {
  branch,
  lifecycle,
  renderComponent,
  withHandlers,
  withStateHandlers,
} from 'recompose'
import Button from '@material-ui/core/Button'
import { styled } from '@material-ui/styles'

import Working from 'components/Working'
import * as Sentry from 'utils/Sentry'
import copyToClipboard from 'utils/clipboard'
import defer from 'utils/defer'
import { composeComponent } from 'utils/reactTools'

import { getCode } from './actions'
import * as Layout from './Layout'

const Container = Layout.mkLayout('Code')

const Code = styled('div')({
  overflowWrap: 'break-word',
})

export default composeComponent(
  'Auth.Code',
  connect(),
  withStateHandlers(
    {
      result: null,
    },
    {
      setResult: () => (result) => ({ result }),
    },
  ),
  withHandlers({
    copy: ({ result }) => () => {
      copyToClipboard(result)
    },
  }),
  Sentry.inject(),
  lifecycle({
    componentWillMount() {
      const result = defer()
      this.props.dispatch(getCode(result.resolver))
      result.promise.then(this.props.setResult).catch((e) => {
        this.props.sentry('captureException', e)
        this.props.setResult(e)
      })
    },
  }),
  branch(
    (p) => p.result instanceof Error,
    renderComponent(() => (
      <Container>
        <Layout.Message>Something went wrong. Try again later.</Layout.Message>
      </Container>
    )),
  ),
  branch(
    (p) => p.result,
    renderComponent(({ result, copy }) => (
      <Container>
        <Code>{result}</Code>
        <Layout.Actions>
          <Button color="primary" variant="contained" onClick={copy}>
            Copy to clipboard
          </Button>
        </Layout.Actions>
      </Container>
    )),
  ),
  () => (
    <Container>
      <Working>Getting the code</Working>
    </Container>
  ),
)
