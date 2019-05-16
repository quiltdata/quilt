import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { unstable_Box as Box } from '@material-ui/core/Box'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import { withStyles } from '@material-ui/styles'

import * as BucketConfig from 'utils/BucketConfig'
import * as RT from 'utils/reactTools'

import BucketSelect from './BucketSelect'
import Search from './Search'

const BucketDisplay = RT.composeComponent(
  'NavBar.BucketControls.BucketDisplay',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    select: PT.func.isRequired,
  }),
  withStyles(() => ({
    root: {
      textTransform: 'none !important',
    },
    s3: {
      opacity: 0.7,
    },
    bucket: {
      maxWidth: 320,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  })),
  ({ classes, bucket, select }) => (
    <Button color="inherit" className={classes.root} onClick={select}>
      <span className={classes.s3}>s3://</span>
      <span className={classes.bucket}>{bucket}</span>
      <Icon>expand_more</Icon>
    </Button>
  ),
)

const BucketDisplaySelect = ({ bucket }) => {
  const [selecting, setSelecting] = React.useState(false)
  const select = React.useCallback(() => {
    setSelecting(true)
  }, [])
  const cancel = React.useCallback(() => {
    setSelecting(false)
  }, [])

  return selecting ? (
    <BucketSelect autoFocus cancel={cancel} />
  ) : (
    <BucketDisplay bucket={bucket} select={select} />
  )
}

export default () => {
  const bucket = BucketConfig.useCurrentBucket()
  return (
    <Box display="flex" alignItems="center">
      {bucket ? (
        <React.Fragment>
          <BucketDisplaySelect bucket={bucket} />
          <Search />
        </React.Fragment>
      ) : (
        <BucketSelect />
      )}
    </Box>
  )
}
