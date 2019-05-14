import { push } from 'connected-react-router/immutable'
import deburr from 'lodash/deburr'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'
import * as reduxHook from 'redux-react-hook'
import CircularProgress from '@material-ui/core/CircularProgress'
import Divider from '@material-ui/core/Divider'
import Input from '@material-ui/core/Input'
import InputAdornment from '@material-ui/core/InputAdornment'
import ListItemText from '@material-ui/core/ListItemText'
import MenuItem from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'
import Paper from '@material-ui/core/Paper'
import Popper from '@material-ui/core/Popper'
import { ThemeProvider, makeStyles, withStyles } from '@material-ui/styles'

import * as style from 'constants/style'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const DIVIDER = '<DIVIDER>'

const NavInput = RT.composeComponent(
  'NavBar.BucketSelect.NavInput',
  RT.wrap(ThemeProvider, () => ({ theme: style.themeInverted })),
  withStyles(({ palette }) => ({
    underline: {
      '&:after': {
        borderBottomColor: palette.secondary.main,
      },
    },
    input: {
      textOverflow: 'ellipsis',
    },
  })),
  Input,
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

const useStyles = makeStyles(({ spacing: { unit }, zIndex }) => ({
  input: {
    marginLeft: unit * 2,
  },
  popper: {
    zIndex: zIndex.appBar + 1,
  },
  item: {
    paddingBottom: 20,
    paddingTop: 20,
  },
  description: {
    maxWidth: 50 * unit,
  },
  icon: {
    height: 40,
    width: 40,
  },
}))

// TODO: better placeholder styling
const Placeholder = () => <Delay>{() => <CircularProgress />}</Delay>

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
      <React.Fragment>
        <NavInput
          startAdornment={<InputAdornment>s3://</InputAdornment>}
          value={value}
          className={classes.input}
          autoFocus={autoFocus}
          onKeyDown={handleKey}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder=" Enter bucket name"
        />
        <Popper
          open={!!anchor}
          anchorEl={anchor}
          placement="bottom-end"
          className={classes.popper}
        >
          <Paper>
            <MenuList>
              {suggestions.map((s, i) => {
                // eslint-disable-next-line react/no-array-index-key
                if (s === DIVIDER) return <Divider key={`${s}:${i}`} />
                const b = bucketConfigs[s]
                return (
                  <MenuItem
                    className={classes.item}
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    selected={s === value}
                  >
                    <img src={b.icon} alt={b.title} className={classes.icon} />
                    <ListItemText
                      primary={b.title}
                      secondary={b.description}
                      secondaryTypographyProps={{
                        noWrap: true,
                        className: classes.description,
                      }}
                      title={b.description}
                    />
                  </MenuItem>
                )
              })}
            </MenuList>
          </Paper>
        </Popper>
      </React.Fragment>
    )
  },
)
