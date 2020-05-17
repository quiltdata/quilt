import { push } from 'connected-react-router/esm/immutable'
import deburr from 'lodash/deburr'
import matchSorter from 'match-sorter'
import * as R from 'ramda'
import * as React from 'react'
import AutosizeInput from 'react-input-autosize'
import * as reduxHook from 'redux-react-hook'
import * as M from '@material-ui/core'
import Autocomplete from '@material-ui/lab/Autocomplete'

import * as style from 'constants/style'
import * as BucketConfig from 'utils/BucketConfig'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'

const normalizeBucket = R.pipe(
  deburr,
  R.toLower,
  R.replace(/^[^a-z0-9]+/g, ''),
  R.replace(/[^a-z0-9-.]+/g, '-'),
  R.replace(/[^a-z0-9]+$/g, ''),
)

function WrappedAutosizeInput({ className, ...props }) {
  return <AutosizeInput inputClassName={className} placeholderIsMinWidth {...props} />
}

const useNavInputStyles = M.makeStyles((t) => ({
  input: {
    fontSize: t.typography.button.fontSize,
    fontWeight: t.typography.button.fontWeight,
    height: 18,
    letterSpacing: t.typography.button.letterSpacing,
    lineHeight: 18,
    maxWidth: 200,
    paddingBottom: 7,
    paddingTop: 7,
  },
  underline: {
    '&:after': {
      borderBottomColor: t.palette.primary.main,
    },
  },
}))

const NavInput = React.forwardRef(function NavInput(
  { InputProps, InputLabelProps, ...props },
  ref,
) {
  const classes = useNavInputStyles()
  return (
    <M.Input
      ref={ref}
      classes={classes}
      inputComponent={WrappedAutosizeInput}
      {...InputProps}
      {...props}
    />
  )
})

const useBucketStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    maxWidth: '100%',
  },
  icon: {
    flexShrink: 0,
    height: 40,
    width: 40,
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: t.spacing(1),
    '& > *': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
  title: {
    ...t.typography.body1,
    lineHeight: '20px',
  },
  desc: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
}))

function Bucket({ iconUrl, name, title, description }) {
  const classes = useBucketStyles()
  return (
    <div className={classes.root} title={description}>
      {/* TODO: show text avatar or smth when iconUrl is empty */}
      <img src={iconUrl} alt={title} className={classes.icon} />
      <div className={classes.text}>
        <div className={classes.title}>
          {title} (s3://{name})
        </div>
        <div className={classes.desc}>{description}</div>
      </div>
    </div>
  )
}

function CustomPopper({ style: css, ...props }) {
  return (
    <M.Popper
      {...props}
      style={{ ...css, width: 'auto', maxWidth: 'min(calc(100vw - 8px), 680px)' }}
      placement="bottom-start"
    />
  )
}

function BucketSelect({ cancel, forwardedRef, ...props }) {
  const currentBucket = BucketConfig.useCurrentBucket()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const dispatch = reduxHook.useDispatch()
  const { urls } = NamedRoutes.use()

  const [inputValue, setInputValue] = React.useState('')
  const inputRef = React.useRef()

  React.useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      if (inputRef.current) inputRef.current.focus()
    },
  }))

  return (
    <M.Box {...props}>
      <M.MuiThemeProvider theme={style.appTheme}>
        <Autocomplete
          PopperComponent={CustomPopper}
          freeSolo
          disableClearable
          openOnFocus
          options={bucketConfigs}
          value=""
          inputValue={inputValue}
          onInputChange={(event, newValue) => setInputValue(newValue)}
          onChange={(event, newValue, reason) => {
            if (reason === 'select-option' || reason === 'create-option') {
              const to =
                typeof newValue === 'string' ? normalizeBucket(newValue) : newValue.name
              if (to && currentBucket !== to) {
                dispatch(push(urls.bucketRoot(to)))
              }
            }
          }}
          onClose={() => {
            if (inputRef.current) inputRef.current.blur()
          }}
          filterOptions={(options, params) => {
            const filtered = params.inputValue
              ? matchSorter(options, params.inputValue, {
                  keys: [
                    'name',
                    'title',
                    {
                      key: 'tags',
                      threshold: matchSorter.rankings.WORD_STARTS_WITH,
                    },
                    {
                      key: 'description',
                      maxRanking: matchSorter.rankings.STARTS_WITH,
                      threshold: matchSorter.rankings.ACRONYM,
                    },
                  ],
                })
              : options

            if (
              normalizeBucket(params.inputValue) !== '' &&
              !filtered.find((b) => b.name === params.inputValue)
            ) {
              filtered.unshift(params.inputValue)
            }

            return filtered
          }}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
          renderOption={(option) =>
            typeof option === 'string' ? (
              <>
                <M.Box display="flex" pr={1} fontSize={40}>
                  <M.Icon fontSize="inherit">arrow_forward</M.Icon>
                </M.Box>
                <span>
                  Go to <b>s3://{normalizeBucket(option)}</b>
                </span>
              </>
            ) : (
              <Bucket {...option} />
            )
          }
          renderInput={(inputProps) => (
            <M.MuiThemeProvider theme={style.navTheme}>
              <NavInput
                {...inputProps}
                onBlur={() => {
                  if (cancel) cancel()
                  setTimeout(() => {
                    setInputValue('')
                  }, 100)
                }}
                placeholder="Go to bucket"
                inputRef={inputRef}
              />
            </M.MuiThemeProvider>
          )}
        />
      </M.MuiThemeProvider>
    </M.Box>
  )
}

export default React.forwardRef(function BucketSelectSuspended(props, ref) {
  return (
    <React.Suspense fallback={<Delay>{() => <M.CircularProgress />}</Delay>}>
      <BucketSelect {...props} forwardedRef={ref} />
    </React.Suspense>
  )
})
