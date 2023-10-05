import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'
import * as Lab from '@material-ui/lab'

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
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (!expanded || !ref.current || document.activeElement === ref.current) return
    ref.current.focus()
  }, [expanded])
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
  const { input, onClickAway } = navbarState

  return (
    <Container onClickAway={onClickAway}>
      <Suggestions classes={helpClasses} open={input.helpOpen} />
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
