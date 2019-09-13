import cx from 'classnames'
import { push } from 'connected-react-router/esm/immutable'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as Config from 'utils/Config'
import * as BucketConfig from 'utils/BucketConfig'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import * as RT from 'utils/reactTools'
import { useRoute } from 'utils/router'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0),
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    transition: ['background-color 200ms', 'opacity 200ms', 'width 200ms'],
    width: t.spacing(24),
    '&:not($iconized)': {
      background: fade(t.palette.common.white, 0.1),
    },
    '&:not($disabled):not($iconized):hover': {
      background: fade(t.palette.common.white, 0.2),
    },
  },
  iconized: {
    width: t.spacing(4),
  },
  disabled: {
    opacity: 0.8,
  },
  hidden: {
    opacity: 0,
  },
  focused: {
    background: `${fade(t.palette.common.white, 0.2)} !important`,
    width: '100%',
  },
  input: {
    paddingLeft: t.spacing(4),
    paddingTop: 8,
    paddingBottom: 9,
    textOverflow: 'ellipsis',
    transition: ['opacity 200ms'],
    '$iconized:not($focused) &': {
      opacity: 0,
    },
  },
  adornment: {
    cursor: 'pointer',
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    width: t.spacing(4),
  },
}))

const SearchBox = ({ bucket, disabled, iconized, hidden, focused, ...props }) => {
  const {
    adornment,
    disabled: disabledCls,
    iconized: iconizedCls,
    hidden: hiddenCls,
    ...classes
  } = useStyles()
  return (
    <M.InputBase
      startAdornment={
        <M.InputAdornment className={adornment}>
          <M.Icon>search</M.Icon>
        </M.InputAdornment>
      }
      classes={classes}
      className={cx({
        [disabledCls]: disabled,
        [iconizedCls]: iconized,
        [hiddenCls]: hidden,
      })}
      placeholder={
        focused ? `Search ${bucket ? `s3://${bucket}` : 'all buckets'}` : 'Search'
      }
      disabled={disabled}
      {...props}
    />
  )
}

function State({ query, makeUrl, children, onFocus, onBlur }) {
  const dispatch = reduxHook.useDispatch()

  const [value, change] = React.useState(null)
  const [focused, setFocused] = React.useState(false)

  const onChange = React.useCallback((evt) => {
    change(evt.target.value)
  }, [])

  const onKeyDown = React.useCallback(
    (evt) => {
      // eslint-disable-next-line default-case
      switch (evt.key) {
        case 'Enter':
          /* suppress onSubmit (didn't actually find this to be a problem tho) */
          evt.preventDefault()
          if (query !== value) {
            dispatch(push(makeUrl(value)))
          }
          evt.target.blur()
          break
        case 'Escape':
          evt.target.blur()
          break
      }
    },
    [dispatch, makeUrl, value, query],
  )

  const handleFocus = React.useCallback(() => {
    change(query)
    setFocused(true)
    if (onFocus) onFocus()
  }, [query])

  const handleBlur = React.useCallback(() => {
    change(null)
    setFocused(false)
    if (onBlur) onBlur()
  }, [])

  return children({
    value: value === null ? query : value,
    onChange,
    onKeyDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
    focused,
  })
}

function BucketSearch({ bucket, onFocus, onBlur, iconized, ...props }) {
  const cfg = BucketConfig.useBucketConfigs()[bucket]
  const { paths, urls } = NamedRoutes.use()
  const { location: l, match } = useRoute(paths.bucketSearch)
  const query = (match && parse(l.search).q) || ''
  const makeUrl = React.useCallback((q) => urls.bucketSearch(bucket, q), [urls, bucket])
  return cfg && cfg.searchEndpoint ? (
    <State {...{ query, makeUrl, onFocus, onBlur }}>
      {(state) => <SearchBox {...{ iconized, bucket, ...state, ...props }} />}
    </State>
  ) : (
    <SearchBox iconized={iconized} disabled value="Search not available" {...props} />
  )
}

function GlobalSearch({ onFocus, onBlur, iconized, ...props }) {
  const cfg = Config.useConfig()
  const { paths, urls } = NamedRoutes.use()
  const { location: l, match } = useRoute(paths.search)
  const { q: query = '', buckets } = match ? parse(l.search) : {}
  const makeUrl = React.useCallback((q) => urls.search({ q, buckets }), [urls, buckets])
  return !cfg.searchEndpoint ? null : (
    <State {...{ query, makeUrl, onFocus, onBlur }}>
      {(state) => <SearchBox {...{ iconized, ...state, ...props }} />}
    </State>
  )
}

export default RT.withSuspense(() => (
  <Delay alwaysRender>
    {(ready) => (
      <M.Fade in={ready}>
        <M.CircularProgress />
      </M.Fade>
    )}
  </Delay>
))((props) => (props.bucket ? <BucketSearch {...props} /> : <GlobalSearch {...props} />))
