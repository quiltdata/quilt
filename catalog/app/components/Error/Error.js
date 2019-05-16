import PT from 'prop-types'
import * as React from 'react'
import { setPropTypes } from 'recompose'
import { unstable_Box as Box } from '@material-ui/core/Box'
import Typography from '@material-ui/core/Typography'
import { styled } from '@material-ui/styles'

import { composeComponent } from 'utils/reactTools'
import { printObject } from 'utils/string'

import sand from './sand.jpg'

const Img = styled(Box)({
  backgroundImage: `url(${sand})`,
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
})

// TODO add sign in
export default composeComponent(
  'Error',
  setPropTypes({
    headline: PT.node,
    detail: PT.node,
    object: PT.object,
  }),
  ({
    detail = 'Check network connection and login',
    headline = 'Something went wrong',
    object,
  }) => (
    <React.Fragment>
      <Typography variant="h4" gutterBottom>
        {headline}
      </Typography>
      <Typography variant="body1">{detail}</Typography>
      <Img height={600} mt={2} />
      {!!object && <Box component="pre">{printObject(object)}</Box>}
    </React.Fragment>
  ),
)
