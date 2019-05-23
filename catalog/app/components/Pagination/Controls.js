import PT from 'prop-types'
import * as React from 'react'
import { setPropTypes } from 'recompose'
import { FormattedMessage as FM } from 'react-intl'
import { unstable_Box as Box } from '@material-ui/core/Box'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

import messages from './messages'

const Chevron = RT.composeComponent(
  'Pagination.Chevron',
  setPropTypes({
    direction: PT.oneOf(['left', 'right']).isRequired,
  }),
  withStyles((t) => ({
    root: {
      padding: t.spacing.unit * 0.5,
    },
  })),
  ({ classes, direction, ...rest }) => (
    <IconButton className={classes.root} {...rest}>
      <Icon>{`chevron_${direction}`}</Icon>
    </IconButton>
  ),
)

export default RT.composeComponent(
  'Pagination.Controls',
  setPropTypes({
    page: PT.number.isRequired,
    pages: PT.number.isRequired,
    nextPage: PT.func.isRequired,
    prevPage: PT.func.isRequired,
  }),
  ({ page, pages, nextPage, prevPage }) =>
    pages <= 1 ? null : (
      <Box display="flex" alignItems="center">
        <Chevron direction="left" onClick={prevPage} disabled={page <= 1} />
        <Chevron direction="right" onClick={nextPage} disabled={page >= pages} />
        <Box ml={1.5}>
          {page} <FM {...messages.of} /> {pages}
        </Box>
      </Box>
    ),
)
