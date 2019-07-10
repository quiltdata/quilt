import { push } from 'connected-react-router/esm/immutable'
import deburr from 'lodash/deburr'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const DIVIDER = '<DIVIDER>'

const NavInput = RT.composeComponent(
  'NavBar.BucketSelect.NavInput',
  M.withStyles(({ palette }) => ({
    underline: {
      '&:after': {
        borderBottomColor: palette.primary.main,
      },
    },
    input: {
      textOverflow: 'ellipsis',
    },
  })),
  M.Input,
)

const normalizeBucket = R.pipe(
  deburr,
  R.toLower,
  R.replace(/^[^a-z0-9]/g, ''),
  R.replace(/[^a-z0-9-.]/g, '-'),
)

const getCycled = (getter = R.identity) => (arr, val, offset) => {
  const index =
    arr.findIndex(
      R.pipe(
        getter,
        R.equals(val),
      ),
    ) + offset
  const cycledIndex = ((index + 1 + arr.length + 1) % (arr.length + 1)) - 1
  return getter(arr[cycledIndex])
}

const getBucketCycled = getCycled()

const useStyles = M.makeStyles(({ spacing, zIndex }) => ({
  input: {
    marginLeft: spacing(2),
  },
  popper: {
    zIndex: zIndex.appBar + 1,
  },
  item: {
    minHeight: 60,
  },
  description: {
    maxWidth: spacing(50),
  },
  icon: {
    height: 40,
    width: 40,
  },
}))

// TODO: better placeholder styling
const Placeholder = () => <Delay>{() => <M.CircularProgress />}</Delay>

export default RT.composeComponent(
  'NavBar.BucketSelect',
  RC.setPropTypes({
    autoFocus: PT.bool,
    cancel: PT.func,
  }),
  RT.withSuspense(() => <Placeholder />),
  ({ autoFocus = false, cancel }) => {
    const currentBucket = BucketConfig.useCurrentBucket()
    const bucketConfigs = BucketConfig.useBucketConfigs()
    const { suggestedBuckets } = Config.useConfig()
    const classes = useStyles()
    const dispatch = reduxHook.useDispatch()
    const { urls } = NamedRoutes.use()

    const [value, setValue] = React.useState('')
    const [anchor, setAnchor] = React.useState()

    const suggestions = React.useMemo(
      () => suggestedBuckets.filter((s) => s === DIVIDER || !!bucketConfigs[s]),
      [suggestedBuckets, bucketConfigs],
    )

    const buckets = React.useMemo(
      () => suggestedBuckets.filter((s) => !!bucketConfigs[s]),
      [suggestedBuckets, bucketConfigs],
    )

    const nextSuggestion = React.useCallback(() => {
      setValue(getBucketCycled(buckets, value, 1) || '')
    }, [buckets, value])

    const prevSuggestion = React.useCallback(() => {
      setValue(getBucketCycled(buckets, value, -1) || '')
    }, [buckets, value])

    const go = React.useCallback(
      (to) => {
        if (to && currentBucket !== to) {
          dispatch(push(urls.bucketRoot(to)))
        }
        if (cancel) cancel()
      },
      [currentBucket, urls, dispatch, cancel],
    )

    const handleChange = React.useCallback((evt) => {
      setValue(normalizeBucket(evt.target.value))
    }, [])

    const handleFocus = React.useCallback((evt) => {
      setAnchor(evt.target)
    }, [])

    const handleBlur = React.useCallback(() => {
      setTimeout(() => {
        setAnchor(null)
        if (cancel) cancel()
      }, 300)
    }, [cancel])

    const handleKey = React.useCallback(
      (evt) => {
        // eslint-disable-next-line default-case
        switch (evt.key) {
          case 'Enter':
            go(value)
            break
          case 'Escape':
            if (anchor) anchor.blur()
            break
          case 'ArrowUp':
            prevSuggestion()
            break
          case 'ArrowDown':
          case 'Tab':
            // prevent Tab from switching focus
            evt.preventDefault()
            nextSuggestion()
            break
        }
      },
      [anchor, go, value, nextSuggestion, prevSuggestion],
    )

    const handleSuggestion = (s) => {
      setValue(s)
      go(s)
    }

    return (
      <>
        <NavInput
          startAdornment={<M.InputAdornment>s3://</M.InputAdornment>}
          value={value}
          className={classes.input}
          autoFocus={autoFocus}
          onKeyDown={handleKey}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder=" Enter bucket name"
        />
        <M.Popper
          open={!!anchor}
          anchorEl={anchor}
          placement="bottom-end"
          className={classes.popper}
        >
          <M.MuiThemeProvider theme={style.appTheme}>
            <M.Paper>
              <M.MenuList>
                {suggestions.map((s, i) => {
                  // eslint-disable-next-line react/no-array-index-key
                  if (s === DIVIDER) return <M.Divider key={`${s}:${i}`} />
                  const b = bucketConfigs[s]
                  return (
                    <M.MenuItem
                      className={classes.item}
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      selected={s === value}
                    >
                      <img src={b.icon} alt={b.title} className={classes.icon} />
                      <M.Box pr={2} />
                      <M.ListItemText
                        primary={b.title}
                        secondary={b.description}
                        secondaryTypographyProps={{
                          noWrap: true,
                          className: classes.description,
                        }}
                        title={b.description}
                      />
                    </M.MenuItem>
                  )
                })}
              </M.MenuList>
            </M.Paper>
          </M.MuiThemeProvider>
        </M.Popper>
      </>
    )
  },
)
