import * as React from 'react'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import Typography from '@material-ui/core/Typography'
import { styled } from '@material-ui/styles'

import * as Preview from 'components/Preview'
import AsyncResult from 'utils/AsyncResult'

import { withSignedUrl } from './utils'

const Message = styled('div')({
  textAlign: 'center',
  width: '100%',
})

export default ({ handle }) =>
  Preview.load(
    handle,
    AsyncResult.case({
      Ok: AsyncResult.case({
        Init: (_, { fetch }) => (
          <Message>
            <Typography variant="body1" gutterBottom>
              Large files are not previewed automatically
            </Typography>
            <Button variant="outlined" onClick={fetch}>
              Load preview
            </Button>
          </Message>
        ),
        Pending: () => (
          <Message>
            <CircularProgress />
          </Message>
        ),
        Err: (_, { fetch }) => (
          <Message>
            <Typography variant="body1" gutterBottom>
              Error loading preview
            </Typography>
            <Button variant="outlined" onClick={fetch}>
              Retry
            </Button>
          </Message>
        ),
        Ok: (data) => Preview.render(data),
      }),
      Err: Preview.PreviewError.case({
        TooLarge: () => (
          <Message>
            <Typography variant="body1" gutterBottom>
              Object is too large to preview in browser
            </Typography>
            {withSignedUrl(handle, (url) => (
              <Button variant="outlined" href={url}>
                View in Browser
              </Button>
            ))}
          </Message>
        ),
        Unsupported: () => (
          <Message>
            {withSignedUrl(handle, (url) => (
              <Button variant="outlined" href={url}>
                Download and view in Browser
              </Button>
            ))}
          </Message>
        ),
        DoesNotExist: () => (
          <Message>
            <Typography variant="body1">Object does not exist</Typography>
          </Message>
        ),
        MalformedJson: ({ originalError: { message } }) => (
          <Message>
            <Typography variant="body1" gutterBottom>
              Malformed JSON: {message}
            </Typography>
          </Message>
        ),
        Unexpected: (_, { fetch }) => (
          <Message>
            <Typography variant="body1" gutterBottom>
              Error loading preview
            </Typography>
            <Button variant="outlined" onClick={fetch}>
              Retry
            </Button>
          </Message>
        ),
      }),
      _: () => (
        <Message>
          <CircularProgress />
        </Message>
      ),
    }),
  )
