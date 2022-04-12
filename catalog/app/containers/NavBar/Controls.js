import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import BucketSelect from './BucketSelect'
import Collaborators from './Collaborators'
import Search from './Search'

const useBucketDisplayStyles = M.makeStyles((t) => ({
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
}))

function BucketDisplay({ bucket, select, locked = false, ...props }) {
  const classes = useBucketDisplayStyles()
  return (
    <M.Box position="relative" {...props}>
      <M.Button
        color="inherit"
        className={cx(classes.root, { [classes.locked]: locked })}
        onClick={select}
      >
        <span className={classes.s3}>s3://</span>
        <span className={classes.bucket}>{bucket}</span>
        <M.Icon>expand_more</M.Icon>
      </M.Button>
      {locked && <M.Box position="absolute" top={0} bottom={0} left={0} right={0} />}
    </M.Box>
  )
}

const Container = (props) => (
  <M.Box
    height="36px"
    display="flex"
    alignItems="center"
    position="relative"
    flexGrow={1}
    {...props}
  />
)

function GlobalControls({ iconized, disableSearch }) {
  const [state, setState] = React.useState(null)
  const search = React.useCallback(() => {
    setState('search')
  }, [setState])
  const cancel = React.useCallback(() => {
    setState(null)
  }, [setState])

  return (
    <Container pr={{ xs: 6, sm: 0 }}>
      <BucketSelect display={state === 'search' ? 'none' : undefined} />
      <Search
        onFocus={search}
        onBlur={cancel}
        iconized={iconized}
        disabled={disableSearch}
      />
    </Container>
  )
}

function BucketControls({ bucket, iconized, disableSearch }) {
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
      <Collaborators bucket={bucket} hidden={state === 'search'} />
      <Search
        bucket={bucket}
        onFocus={search}
        onBlur={cancel}
        hidden={state === 'select'}
        iconized={iconized}
        disabled={disableSearch}
      />
      <M.Fade in={state === 'select'} onEnter={focusSelect}>
        <BucketSelect cancel={cancel} position="absolute" left={0} ref={selectRef} />
      </M.Fade>
    </Container>
  )
}

export default function Controls({ bucket, disableSearch }) {
  const t = M.useTheme()
  const iconized = M.useMediaQuery(t.breakpoints.down('xs'))
  return bucket ? (
    <BucketControls {...{ bucket, iconized, disableSearch }} />
  ) : (
    <GlobalControls {...{ iconized, disableSearch }} />
  )
}
