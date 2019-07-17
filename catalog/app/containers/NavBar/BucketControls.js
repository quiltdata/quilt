import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import * as M from '@material-ui/core'

import * as RT from 'utils/reactTools'

import BucketSelect from './BucketSelect'
import Search from './Search'

const BucketDisplay = RT.composeComponent(
  'NavBar.BucketControls.BucketDisplay',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    select: PT.func.isRequired,
    locked: PT.bool,
  }),
  M.withStyles((t) => ({
    root: {
      textTransform: 'none !important',
      transition: ['opacity 200ms'],
    },
    locked: {
      opacity: 0,
    },
    s3: {
      opacity: 0.7,
    },
    bucket: {
      maxWidth: 160,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      [t.breakpoints.down('xs')]: {
        maxWidth: 'calc(100vw - 220px)',
      },
    },
  })),
  ({ classes, bucket, select, locked = false, ...props }) => (
    <M.Box position="relative" {...props}>
      {locked && <M.Box position="absolute" top={0} bottom={0} left={0} right={0} />}
      <M.Button
        color="inherit"
        className={cx(classes.root, { [classes.locked]: locked })}
        onClick={select}
      >
        <span className={classes.s3}>s3://</span>
        <span className={classes.bucket}>{bucket}</span>
        <M.Icon>expand_more</M.Icon>
      </M.Button>
    </M.Box>
  ),
)

const Container = (props) => (
  <M.Box display="flex" alignItems="center" position="relative" flexGrow={1} {...props} />
)

const Controls = ({ bucket, iconized }) => {
  const [state, setState] = React.useState(null)
  const select = React.useCallback(() => {
    setState('select')
  }, [setState])
  const search = React.useCallback(() => {
    setState('search')
  }, [setState])
  const cancel = React.useCallback(() => {
    setState(null)
  }, [setState])

  const selectRef = React.useRef()
  const focusSelect = React.useCallback(() => {
    if (selectRef.current) selectRef.current.focus()
  }, [])

  return (
    <Container>
      <BucketDisplay bucket={bucket} select={select} locked={!!state} ml={-1} />
      <Search
        onFocus={search}
        onBlur={cancel}
        hidden={state === 'select'}
        iconized={iconized}
      />
      <M.Fade in={state === 'select'} onEnter={focusSelect}>
        <BucketSelect cancel={cancel} position="absolute" left={0} ref={selectRef} />
      </M.Fade>
    </Container>
  )
}

export default ({ bucket }) => {
  const t = M.useTheme()
  const iconized = M.useMediaQuery(t.breakpoints.down('xs'))

  return bucket ? (
    <Controls {...{ bucket, iconized }} />
  ) : (
    <Container>
      <BucketSelect />
    </Container>
  )
}
