import cx from 'classnames'
import * as React from 'react'
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'
import * as Lab from '@material-ui/lab'

import SearchHelp from 'components/SearchHelp'
import cfg from 'constants/config'
import * as BucketConfig from 'utils/BucketConfig'
import * as CatalogSettings from 'utils/CatalogSettings'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'

const useContainerStyles = M.makeStyles({
  root: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
})

interface ContainerProps {
  children: React.ReactNode
  onClickAway?: M.ClickAwayListenerProps['onClickAway']
}

function Container({ children, onClickAway }: ContainerProps) {
  const classes = useContainerStyles()
  const el = <div className={classes.root}>{children}</div>
  if (!onClickAway) return el
  return <M.ClickAwayListener onClickAway={onClickAway}>{el}</M.ClickAwayListener>
}

const expandAnimationDuration = 200

const useInputStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0),
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden',
    padding: `0 ${t.spacing(1)}px 0 0`,
    position: 'absolute',
    right: 0,
    transition: [
      `background-color ${expandAnimationDuration}ms`,
      `opacity ${expandAnimationDuration}ms`,
      `width ${expandAnimationDuration}ms`,
    ].join(', '),
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
  expanded: {
    background: `${fade(t.palette.common.white, 0.2)} !important`,
    width: '100%',
  },
  input: {
    paddingLeft: t.spacing(1),
    paddingTop: 8,
    paddingBottom: 9,
    textOverflow: 'ellipsis',
    transition: 'opacity 200ms',
    '$iconized:not($expanded) &': {
      opacity: 0,
    },
  },
  inputIcon: {
    cursor: 'pointer',
    '$root$disabled &': {
      cursor: 'not-allowed',
    },
  },
  inputOptions: {
    borderRadius: 0,
    borderWidth: '0 1px 0 0',
    paddingLeft: t.spacing(1.25),
    paddingRight: t.spacing(0.25),
  },
}))

interface SearchInputExternalProps {
  hidden?: boolean
  iconized?: boolean
}

type SearchInputBaseProps = Pick<
  M.InputBaseProps,
  'disabled' | 'value' | 'placeholder' | 'onFocus' | 'onKeyDown' | 'onChange'
>

interface SearchInputProps extends SearchInputExternalProps, SearchInputBaseProps {
  expanded?: boolean
  helpOpen?: boolean
  onHelpToggle?: () => void
}

function SearchInput({
  expanded = false,
  helpOpen = false,
  hidden = false,
  iconized = false,
  onHelpToggle,
  ...props
}: SearchInputProps) {
  const classes = useInputStyles()
  return (
    <M.InputBase
      classes={{ root: classes.root, input: classes.input }}
      className={cx({
        [classes.expanded]: expanded,
        [classes.disabled]: props.disabled,
        [classes.iconized]: iconized,
        [classes.hidden]: hidden,
      })}
      {...props}
      startAdornment={
        <M.InputAdornment position="start">
          {iconized && !expanded ? (
            <M.Icon className={classes.inputIcon} onClick={onHelpToggle}>
              search
            </M.Icon>
          ) : (
            <Lab.ToggleButton
              className={classes.inputOptions}
              size="small"
              value="help"
              selected={helpOpen}
              onChange={onHelpToggle}
              disabled={props.disabled}
            >
              <M.Icon fontSize="small">search</M.Icon>
              <M.Icon fontSize="small">
                {helpOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
              </M.Icon>
            </Lab.ToggleButton>
          )}
        </M.InputAdornment>
      }
    />
  )
}

function useSearchUrlState(bucket?: string) {
  const { paths, urls } = NamedRoutes.use()
  const location = useLocation()
  const match = useRouteMatch(paths.search)
  const isInStack = BucketConfig.useIsInStack()
  const settings = CatalogSettings.use()

  const qs = match && parse(location.search, true)

  const query = qs?.q ?? ''
  const mode = qs?.mode ?? settings?.search?.mode
  // if not in stack, search all buckets
  const buckets = qs?.buckets ?? (bucket && isInStack(bucket) ? bucket : undefined)

  const makeUrl = React.useCallback(
    (q: string | null) => urls.search({ q, buckets, mode }),
    [urls, buckets, mode],
  )

  const bucketList = React.useMemo(() => buckets?.split(',') ?? [], [buckets])

  return { query, makeUrl, buckets: bucketList }
}

interface SearchState {
  buckets: string[]
  input: SearchInputProps
  help: Pick<Parameters<typeof SearchHelp>[0], 'open' | 'onQuery'>
  onClickAway: () => void
}

interface SearchProps extends SearchInputExternalProps {
  bucket?: string
  onFocus?: () => void
  onBlur?: () => void
}

function useSearchState({ bucket, onFocus, onBlur, ...props }: SearchProps): SearchState {
  const history = useHistory()

  const { query, makeUrl, buckets } = useSearchUrlState(bucket)

  const [value, change] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)

  const onChange = React.useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    change(evt.target.value)
  }, [])

  const handleExpand = React.useCallback(() => {
    if (expanded) return
    change(query)
    setExpanded(true)
    onFocus?.()
  }, [expanded, query, onFocus])

  const handleCollapse = React.useCallback(() => {
    change(null)
    setExpanded(false)
    setHelpOpen(false)
    onBlur?.()
  }, [onBlur])

  const handleHelpOpen = React.useCallback(() => setHelpOpen(true), [])

  const handleHelpClose = React.useCallback(() => setHelpOpen(false), [])

  const onQuery = React.useCallback(
    (strPart: string) => change((v) => (v ? `${v} ${strPart}` : strPart)),
    [],
  )

  const onHelpToggle = React.useCallback(() => {
    if (helpOpen) {
      handleHelpClose()
      return
    }
    if (expanded) {
      handleHelpOpen()
    } else {
      handleExpand()
      setTimeout(handleHelpOpen, expandAnimationDuration + 100)
    }
  }, [expanded, helpOpen, handleExpand, handleHelpClose, handleHelpOpen])

  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      switch (evt.key) {
        case 'Enter':
          // suppress onSubmit
          evt.preventDefault()
          if (query !== value) {
            history.push(makeUrl(value))
          }
          handleCollapse()
          evt.currentTarget.blur()
          break
        case 'Tab':
        case 'Escape':
          handleCollapse()
          evt.currentTarget.blur()
          break
        case 'ArrowDown':
          handleHelpOpen()
          break
      }
    },
    [history, makeUrl, value, query, handleCollapse, handleHelpOpen],
  )

  const onClickAway = React.useCallback(() => {
    if (expanded || helpOpen) handleCollapse()
  }, [expanded, helpOpen, handleCollapse])

  return {
    buckets,
    input: {
      expanded,
      helpOpen,
      onChange,
      onFocus: handleExpand,
      onHelpToggle,
      onKeyDown,
      value: value === null ? query : value,
      ...props,
    },
    help: {
      onQuery,
      open: helpOpen,
    },
    onClickAway,
  }
}

function displayBucketNames(names: string[]) {
  if (names.length > 1) return `${names.length} buckets`
  if (names.length === 1) return `s3://${names[0]}`
  return 'all buckets'
}

const useHelpStyles = M.makeStyles((t) => ({
  contents: {
    maxHeight: t.spacing(50),
    overflowY: 'auto',
    padding: t.spacing(0, 4),
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(0, 1),
    },
  },
  paper: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: t.spacing(5),
    [t.breakpoints.down('xs')]: {
      left: '-43px',
      right: '-36px',
    },
  },
}))

function Search(props: SearchProps) {
  const helpClasses = useHelpStyles()
  const { buckets, onClickAway, input, help } = useSearchState(props)
  const placeholder = input.expanded ? `Search ${displayBucketNames(buckets)}` : 'Search'

  return (
    <Container onClickAway={onClickAway}>
      <SearchHelp classes={helpClasses} {...help} />
      <SearchInput placeholder={placeholder} {...input} />
    </Container>
  )
}

function SearchNotAvailable() {
  return (
    <Container>
      <SearchInput disabled value="Search not available" />
    </Container>
  )
}

function DelayedProgress() {
  return (
    <Delay alwaysRender>
      {(ready) => (
        <M.Fade in={ready}>
          <M.CircularProgress />
        </M.Fade>
      )}
    </Delay>
  )
}

export default function SearchWrapper(props: SearchProps) {
  if (cfg.disableNavigator) return null
  if (cfg.mode === 'LOCAL') return <SearchNotAvailable />
  return (
    <React.Suspense fallback={<DelayedProgress />}>
      <Search {...props} />
    </React.Suspense>
  )
}
