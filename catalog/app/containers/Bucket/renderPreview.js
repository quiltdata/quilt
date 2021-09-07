import * as React from 'react'
import * as M from '@material-ui/core'

import * as Preview from 'components/Preview'

const Message = M.styled('div')({
  textAlign: 'center',
  width: '100%',
})

const renderMessage = ({ heading, body, action }) => (
  <Message>
    {!!heading && (
      <M.Typography variant="h6" gutterBottom>
        {heading}
      </M.Typography>
    )}
    {!!body && (
      <M.Typography variant="body1" gutterBottom>
        {body}
      </M.Typography>
    )}
    {!!action && action}
  </Message>
)

const renderProgress = () => (
  <Message>
    <M.CircularProgress />
  </Message>
)

export default (onData) => Preview.display({ renderMessage, renderProgress, onData })
