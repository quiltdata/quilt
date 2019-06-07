/* Main landing page feature */
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { Box, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

import background from './background.png'
import strings from './messages'

const Back = styled(Box)({
  backgroundImage: `url(${background})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'contain',
})

const Thin = styled(Typography)({
  fontWeight: 300,
})

export default RT.composeComponent(
  'Feature',
  RC.setPropTypes({
    header: PT.string,
    tagline: PT.string,
  }),
  ({
    // TODO do not abuse string tables like this; belongs in a FormattedMessage,
    // but those don't support default values well?
    header = strings.header.defaultMessage,
    tagline = strings.tagline.defaultMessage,
  }) => (
    <Back p={8} height={600} color="white">
      <Thin variant="h3" color="inherit" gutterBottom>
        {header}
      </Thin>
      <Thin variant="body1" color="inherit">
        {tagline}
      </Thin>
    </Back>
  ),
)
