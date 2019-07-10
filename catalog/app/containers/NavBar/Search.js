import cx from 'classnames'
import { push } from 'connected-react-router/esm/immutable'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import InputAdornment from '@material-ui/core/InputAdornment'
import InputBase from '@material-ui/core/InputBase'
import { makeStyles } from '@material-ui/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as BucketConfig from 'utils/BucketConfig'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import * as RT from 'utils/reactTools'
import { useRoute } from 'utils/router'

const useStyles = makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0.9),
    color: t.palette.getContrastText(t.palette.common.white),
    borderRadius: t.shape.borderRadius,
    marginLeft: t.spacing(2),
    minWidth: 240,
    '&:not($disabled):hover': {
      background: t.palette.common.white,
    },
  },
  disabled: {
    opacity: 0.8,
  },
  focused: {
    background: t.palette.common.white,
  },
  input: {
    paddingLeft: t.spacing(4),
    textOverflow: 'ellipsis',
  },
  adornment: {
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    width: t.spacing(4),
  },
}))

const SearchBox = ({ disabled, ...props }) => {
  const { adornment, disabled: disabledCls, ...classes } = useStyles()
  return (
    <InputBase
      startAdornment={
        <InputAdornment className={adornment}>
          <Icon>search</Icon>
        </InputAdornment>
      }
      classes={classes}
      className={cx({ [disabledCls]: disabled })}
      placeholder="Search"
      disabled={disabled}
      {...props}
    />
  )
}

const State = RT.composeComponent(
  'NavBar.Search.State',
  RC.setPropTypes({
    children: PT.func.isRequired,
    bucket: PT.string.isRequired,
  }),
  ({ bucket, children }) => {
    const { paths, urls } = NamedRoutes.use()
    const { location: l, match } = useRoute(paths.bucketSearch)
    const query = (match && parse(l.search).q) || ''
    const dispatch = reduxHook.useDispatch()

    const [value, change] = React.useState(null)

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
              dispatch(push(urls.bucketSearch(bucket, value)))
            }
            evt.target.blur()
            break
          case 'Escape':
            evt.target.blur()
            break
        }
      },
      [dispatch, urls, bucket, value, query],
    )

    const onFocus = React.useCallback(() => {
      change(query)
    }, [query])

    const onBlur = React.useCallback(() => {
      change(null)
    }, [])

    return children({
      value: value === null ? query : value,
      onChange,
      onKeyDown,
      onFocus,
      onBlur,
    })
  },
)

export default RT.composeComponent(
  'NavBar.Search',
  RT.withSuspense(() => <Delay>{() => <CircularProgress />}</Delay>),
  () => {
    const { name, searchEndpoint } = BucketConfig.useCurrentBucketConfig()
    return searchEndpoint ? (
      <State bucket={name}>{(state) => <SearchBox {...state} />}</State>
    ) : (
      <SearchBox disabled value="Search not available" />
    )
  },
)
