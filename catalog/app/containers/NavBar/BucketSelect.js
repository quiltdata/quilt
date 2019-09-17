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
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

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

const useStyles = M.makeStyles((t) => ({
  inputRoot: {
    width: '100%',
  },
  input: {
    fontSize: t.typography.button.fontSize,
    fontWeight: t.typography.button.fontWeight,
    height: 18,
    letterSpacing: t.typography.button.letterSpacing,
    lineHeight: 18,
    paddingBottom: 7,
    paddingTop: 7,
  },
  popper: {
    zIndex: t.zIndex.appBar + 1,
  },
  paper: {
    maxHeight: 'calc(100vh - 80px)',
    maxWidth: 'calc(100vw - 8px)',
    overflowY: 'auto',
  },
  item: {
    minHeight: 60,
  },
  description: {
    maxWidth: t.spacing(50),
  },
  icon: {
    flexShrink: 0,
    height: 40,
    width: 40,
  },
}))

// TODO: better placeholder styling
const Placeholder = () => <Delay>{() => <M.CircularProgress />}</Delay>

const Adornment = ({ children }) => {
  const t = M.useTheme()
  return (
    <M.InputAdornment disableTypography>
      <M.Box
        fontSize="button.fontSize"
        fontWeight="button.fontWeight"
        letterSpacing={t.typography.button.letterSpacing}
      >
        {children}
      </M.Box>
    </M.InputAdornment>
  )
}

const withForwardedRef = (prop = 'forwardedRef') => (Component) =>
  React.forwardRef((props, ref) => <Component {...props} {...{ [prop]: ref }} />)

export default withForwardedRef()(
  RT.composeComponent(
    'NavBar.BucketSelect',
    RC.setPropTypes({
      autoFocus: PT.bool,
      cancel: PT.func,
    }),
    RT.withSuspense(() => <Placeholder />),
    ({ autoFocus = false, cancel, forwardedRef, ...props }) => {
      const currentBucket = BucketConfig.useCurrentBucket()
      const bucketConfigs = BucketConfig.useBucketConfigs()
      const classes = useStyles()
      const dispatch = reduxHook.useDispatch()
      const { urls } = NamedRoutes.use()

      const [value, setValue] = React.useState('')
      const [popper, setPopper] = React.useState(false)
      const inputRef = React.useRef()
      const anchorRef = React.useRef()

      React.useImperativeHandle(forwardedRef, () => ({
        focus: () => {
          inputRef.current.focus()
        },
      }))

      const buckets = React.useMemo(() => bucketConfigs.map((b) => b.name), [
        bucketConfigs,
      ])

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

      const handleChange = React.useCallback(
        (evt) => {
          setValue(normalizeBucket(evt.target.value))
        },
        [setValue],
      )

      const handleFocus = React.useCallback(() => {
        setValue('')
        setPopper(true)
      }, [setValue, setPopper])

      const handleBlur = React.useCallback(() => {
        // without timeout popover click gets ignored
        setTimeout(() => {
          setPopper(false)
          if (cancel) cancel()
        }, 100)
      }, [cancel])

      const handleKey = React.useCallback(
        (evt) => {
          // eslint-disable-next-line default-case
          switch (evt.key) {
            case 'Enter':
              go(value)
              break
            case 'Escape':
              if (inputRef.current) inputRef.current.blur()
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
        [inputRef.current, go, value, nextSuggestion, prevSuggestion],
      )

      const handleSuggestion = (s) => {
        setValue(s)
        go(s)
      }

      return (
        <>
          <M.Box {...props} ref={anchorRef}>
            <NavInput
              startAdornment={<Adornment>s3://</Adornment>}
              value={value}
              className={classes.inputRoot}
              classes={{ input: classes.input }}
              autoFocus={autoFocus}
              onKeyDown={handleKey}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder=" Enter bucket name"
              inputRef={inputRef}
            />
          </M.Box>
          <M.Popper
            open={popper}
            anchorEl={anchorRef.current}
            placement="bottom-start"
            className={classes.popper}
            transition
          >
            {({ TransitionProps }) => (
              <M.MuiThemeProvider theme={style.appTheme}>
                <M.Fade {...TransitionProps} timeout={350}>
                  <M.Paper className={classes.paper}>
                    <M.MenuList>
                      {bucketConfigs.map((b) => (
                        <M.MenuItem
                          className={classes.item}
                          key={b.name}
                          onClick={() => handleSuggestion(b.name)}
                          selected={b.name === value}
                        >
                          <img src={b.icon_url} alt={b.title} className={classes.icon} />
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
                      ))}
                    </M.MenuList>
                  </M.Paper>
                </M.Fade>
              </M.MuiThemeProvider>
            )}
          </M.Popper>
        </>
      )
    },
  ),
)
