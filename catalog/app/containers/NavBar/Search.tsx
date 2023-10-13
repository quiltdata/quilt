import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'

import cfg from 'constants/config'
import Delay from 'utils/Delay'

import { useNavBar, expandAnimationDuration } from './Provider'
import Suggestions from './Suggestions'

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
    paddingLeft: t.spacing(0.5),
    paddingTop: 8,
    paddingBottom: 9,
    textOverflow: 'ellipsis',
    transition: 'opacity 200ms',
    '$iconized:not($expanded) &': {
      opacity: 0,
    },
  },
  inputIcon: {
    color: t.palette.text.hint,
    margin: t.spacing(1, 0, 1, 1.5),
  },
}))

interface SearchProps {
  hidden?: boolean
  iconized?: boolean
}

type SearchInputBaseProps = Pick<
  M.InputBaseProps,
  'disabled' | 'value' | 'placeholder' | 'onFocus' | 'onKeyDown' | 'onChange'
>

interface SearchInputProps extends SearchProps, SearchInputBaseProps {
  expanded?: boolean
  focusTrigger?: number
}

function SearchInput({
  expanded = false,
  hidden = false,
  iconized = false,
  focusTrigger = 0,
  ...props
}: SearchInputProps) {
  const classes = useInputStyles()
  const ref = React.useRef<HTMLInputElement>(null)
  const focus = React.useCallback(() => ref.current?.focus(), [])
  React.useEffect(() => {
    if (focusTrigger && document.activeElement !== ref.current) {
      focus()
    }
  }, [focus, focusTrigger])
  return (
    <M.InputBase
      classes={{ root: classes.root, input: classes.input }}
      className={cx({
        [classes.expanded]: expanded,
        [classes.disabled]: props.disabled,
        [classes.iconized]: iconized,
        [classes.hidden]: hidden,
      })}
      inputRef={ref}
      {...props}
      startAdornment={
        <M.InputAdornment position="start">
          <M.Icon fontSize="small" className={classes.inputIcon} onClick={focus}>
            search
          </M.Icon>
        </M.InputAdornment>
      }
    />
  )
}

const useHelpStyles = M.makeStyles((t) => ({
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
  const navbarState = useNavBar()
  if (!navbarState) return <SearchNotAvailable />
  const {
    input: { helpOpen, ...input },
    onClickAway,
  } = navbarState

  return (
    <Container onClickAway={onClickAway}>
      <Suggestions classes={helpClasses} open={helpOpen} />
      <SearchInput placeholder="Search" {...input} {...props} />
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
