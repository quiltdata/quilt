import * as React from 'react'
import * as redux from 'react-redux'
import Button from '@material-ui/core/Button'
import { styled } from '@material-ui/styles'

import Working from 'components/Working'
import * as Sentry from 'utils/Sentry'
import copyToClipboard from 'utils/clipboard'
import defer from 'utils/defer'

import { getCode } from './actions'
import * as Layout from './Layout'

const Container = Layout.mkLayout('Code')

const Code = styled('div')({
  overflowWrap: 'break-word',
})

export default function AuthCode() {
  const [result, setResult] = React.useState(null)
  const copy = React.useCallback(() => copyToClipboard(result), [result])
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()

  React.useEffect(() => {
    const deferedResult = defer()
    dispatch(getCode(deferedResult.resolver))
    deferedResult.promise.then(setResult).catch((e) => {
      sentry('captureException', e)
      setResult(e)
    })
  }, [dispatch, sentry])

  if (result instanceof Error) {
    return (
      <Container>
        <Layout.Message>Something went wrong. Try again later.</Layout.Message>
      </Container>
    )
  }

  if (!result) {
    return (
      <Container>
        <Working>Getting the code</Working>
      </Container>
    )
  }

  return (
    <Container>
      <Code>{result}</Code>
      <Layout.Actions>
        <Button color="primary" variant="contained" onClick={copy}>
          Copy to clipboard
        </Button>
      </Layout.Actions>
    </Container>
  )
}
