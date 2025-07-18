import deburr from 'lodash/deburr'
import { matchSorter } from 'match-sorter'
import * as R from 'ramda'
import * as React from 'react'
import AutosizeInput, { AutosizeInputProps } from 'react-input-autosize'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'
import Autocomplete from '@material-ui/lab/Autocomplete'

import BucketIcon from 'components/BucketIcon'
import * as style from 'constants/style'
import * as BucketConfig from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'

const normalizeBucket: (b: string) => string = R.pipe(
  deburr,
  R.toLower,
  R.replace(/^[^a-z0-9]+/g, ''),
  R.replace(/[^a-z0-9-.]+/g, '-'),
  R.replace(/[^a-z0-9]+$/g, ''),
)

function WrappedAutosizeInput({
  className,
  ...props
}: Omit<AutosizeInputProps, 'ref'> & { className?: string }) {
  return <AutosizeInput inputClassName={className} placeholderIsMinWidth {...props} />
}

const useNavInputStyles = M.makeStyles((t) => ({
  input: {
    fontSize: t.typography.button.fontSize,
    fontWeight: t.typography.button.fontWeight,
    height: 18,
    letterSpacing: t.typography.button.letterSpacing,
    lineHeight: '18px',
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

interface NavInputProps extends Omit<M.InputProps, 'InputLabelProps'> {
  InputProps: M.InputProps
  InputLabelProps: any
}

const NavInput = React.forwardRef<AutosizeInput, NavInputProps>(function NavInput(
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
    alignItems: 'center',
  },
  icon: {
    flexShrink: 0,
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

interface BucketProps {
  iconUrl: string | null
  name: string
  title: string
  description: string | null
}

function Bucket({ iconUrl, name, title, description }: BucketProps) {
  const classes = useBucketStyles()
  return (
    <div className={classes.root} title={description || undefined}>
      <BucketIcon alt={title} className={classes.icon} src={iconUrl || undefined} />
      <div className={classes.text}>
        <div className={classes.title}>
          {title} (s3://{name})
        </div>
        <div className={classes.desc}>{description}</div>
      </div>
    </div>
  )
}

interface CustomPopperProps extends M.PopperProps {
  css?: React.CSSProperties
}

function CustomPopper({ style: css, ...props }: CustomPopperProps) {
  return (
    <M.Popper
      {...props}
      style={{ ...css, width: 'auto', maxWidth: 'min(calc(100vw - 8px), 680px)' }}
      placement="bottom-start"
    />
  )
}

type Option = ReturnType<typeof BucketConfig.useRelevantBucketConfigs>[number] | string

interface FocusHandler {
  focus: () => void
}

interface BucketSelectProps extends M.BoxProps {
  forwardedRef: React.Ref<FocusHandler>
  cancel?: () => void
}

function BucketSelect({ cancel, forwardedRef, ...props }: BucketSelectProps) {
  const currentBucket = BucketConfig.useCurrentBucket()
  // XXX: consider using graphql directly
  const bucketConfigs: Option[] = BucketConfig.useRelevantBucketConfigs()
  const history = useHistory()
  const { urls } = NamedRoutes.use()

  const [inputValue, setInputValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

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
          onInputChange={(_event, newValue) => setInputValue(newValue)}
          onChange={(_event, newValue, reason) => {
            if (reason === 'select-option' || reason === 'create-option') {
              const to =
                typeof newValue === 'string' ? normalizeBucket(newValue) : newValue.name
              if (to && currentBucket !== to) {
                history.push(urls.bucketRoot(to))
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
              !filtered.find((b) => typeof b !== 'string' && b.name === params.inputValue)
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

export default React.forwardRef<FocusHandler, Omit<BucketSelectProps, 'forwardedRef'>>(
  function BucketSelectSuspended(props, ref) {
    return (
      <React.Suspense
        fallback={
          <M.Fade in style={{ transitionDelay: '1000ms' }}>
            <M.CircularProgress />
          </M.Fade>
        }
      >
        <BucketSelect {...props} forwardedRef={ref} />
      </React.Suspense>
    )
  },
)
