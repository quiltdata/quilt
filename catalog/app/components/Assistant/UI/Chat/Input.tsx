import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from '../../Model'
import * as ModelChoice from '../../Model/ModelChoice'
import * as style from 'constants/style'
import { createCustomAppTheme } from 'constants/style'
import useId from 'utils/useId'

const useStyles = M.makeStyles((t) => ({
  input: {
    alignItems: 'center',
    display: 'flex',
    paddingLeft: `${t.spacing(2)}px`,
    paddingRight: `${t.spacing(2)}px`,
  },
  textField: {
    marginTop: 0,
  },
  hint: {
    color: t.palette.text.hint,
  },
  // `&$hint` compiles to `.severity.hint` so stacking via `cx(hint,
  // classes[severity])` wins specificity over the base.
  warning: {
    '&$hint': {
      color: t.palette.warning.dark,
    },
  },
  error: {
    '&$hint': {
      color: t.palette.error.dark,
    },
  },
}))

// Called during ChatInput's render, outside the dark ThemeProvider below, so
// `t` is the app theme: the field sits on the midnight chassis (primary).
const useInputStyles = M.makeStyles((t) => {
  const backgroundColor = t.palette.primary.main
  const backgroundColorLt = M.lighten(backgroundColor, 0.1)
  return {
    focused: {},
    disabled: {},
    root: {
      backgroundColor,
      borderRadius: t.shape.borderRadius * 2,
      color: M.fade(t.palette.primary.contrastText, 0.8),
      '&:hover': {
        backgroundColor: backgroundColorLt,
        // Reset on touch devices, it doesn't add specificity
        '@media (hover: none)': {
          backgroundColor,
        },
      },
      '&$focused': {
        backgroundColor,
      },
      '&$disabled': {
        backgroundColor: backgroundColorLt,
      },
    },
  }
})

const useLabelStyles = M.makeStyles((t) => ({
  focused: {},
  root: {
    color: M.fade(t.palette.primary.contrastText, 0.7),
    '&$focused': {
      color: M.fade(t.palette.primary.contrastText, 0.7),
    },
  },
}))

const usePickerStyles = M.makeStyles((t) => ({
  button: {
    ...t.typography.caption,
    color: 'inherit',
    fontWeight: t.typography.fontWeightMedium,
    minWidth: 0,
    padding: t.spacing(0.5, 1),
    textTransform: 'none',
    whiteSpace: 'nowrap',
    // An untiered name shows in full; the tooltip carries the id.
    maxWidth: t.spacing(20),
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  check: {
    marginRight: t.spacing(1),
    minWidth: 0,
  },
  itemId: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    display: 'block',
    fontFamily: t.typography.monospace?.fontFamily ?? 'monospace',
  },
}))

interface ModelPickerProps {
  model: Model.Assistant.API['model']
  disabled?: boolean
}

/**
 * Switches among the admin-approved models. Renders nothing when no set is
 * approved: the model is then a Developer Tools override, not a user choice.
 */
export function ModelPicker({ model, disabled }: ModelPickerProps) {
  const classes = usePickerStyles()
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const close = React.useCallback(() => setAnchor(null), [])
  // A turn starting with the menu open must not leave it switchable mid-turn.
  React.useEffect(() => {
    if (disabled) close()
  }, [disabled, close])
  if (!model.allowlist) return null
  const currentName = ModelChoice.nameIn(model.names, model.current)
  const current = ModelChoice.label(model.current, currentName)
  return (
    <>
      <M.Tooltip title={model.current}>
        <span>
          <M.Button
            className={classes.button}
            aria-haspopup="menu"
            aria-expanded={!!anchor}
            aria-label={`Model: ${current}`}
            disabled={disabled}
            onClick={(e) => setAnchor(e.currentTarget)}
            size="small"
            endIcon={<M.Icon fontSize="small">expand_more</M.Icon>}
          >
            <span className={classes.label}>
              {currentName ??
                ModelChoice.tier(model.current) ??
                ModelChoice.displayName(model.current)}
            </span>
          </M.Button>
        </span>
      </M.Tooltip>
      {/* The input sits on the dark chat ground; its menu is light, like every other menu. */}
      <M.MuiThemeProvider theme={style.appTheme}>
        <M.Menu
          anchorEl={anchor}
          open={!!anchor && !disabled}
          onClose={close}
          getContentAnchorEl={null}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          {model.allowlist.map((id) => (
            <M.MenuItem
              key={id}
              onClick={() => {
                model.select(id)
                close()
              }}
              selected={id === model.current}
              aria-checked={id === model.current}
              role="menuitemradio"
            >
              <M.ListItemIcon className={classes.check}>
                <M.Icon
                  fontSize="small"
                  style={{ visibility: id === model.current ? 'visible' : 'hidden' }}
                >
                  check
                </M.Icon>
              </M.ListItemIcon>
              <span>
                {ModelChoice.label(id, ModelChoice.nameIn(model.names, id))}
                <span className={classes.itemId}>{id}</span>
              </span>
            </M.MenuItem>
          ))}
        </M.Menu>
      </M.MuiThemeProvider>
    </>
  )
}

// The Focus Ring Rule on the dark ground: amber, which the base theme does not set here.
export const darkTheme = createCustomAppTheme({
  palette: { type: 'dark' },
  overrides: {
    MuiButtonBase: {
      root: {
        '&.Mui-focusVisible': {
          outline: `2px solid ${style.appTheme.palette.secondary.main}`,
          outlineOffset: -2,
        },
      },
    },
  },
} as any)

interface ChatInputProps {
  className?: string
  disabled?: boolean
  /** Override the default disclaimer; severity colors the text. */
  helperText?: React.ReactNode
  helperSeverity?: 'warning' | 'error'
  model?: Model.Assistant.API['model']
  onSubmit: (value: string) => void
}

const DEFAULT_HELPER_TEXT = 'Qurator may make errors. Verify important information.'

export default function ChatInput({
  className,
  disabled,
  helperText,
  helperSeverity,
  model,
  onSubmit,
}: ChatInputProps) {
  const classes = useStyles()
  const helperClass = cx(classes.hint, helperSeverity && classes[helperSeverity])
  const id = useId()

  const [value, setValue] = React.useState('')

  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      if (!value || disabled) return
      onSubmit(value)
      setValue('')
    },
    [disabled, onSubmit, value],
  )

  return (
    <form className={cx(classes.input, className)} onSubmit={handleSubmit}>
      <M.ThemeProvider theme={darkTheme}>
        <M.TextField
          className={classes.textField}
          id={id}
          onChange={(e) => setValue(e.target.value)}
          value={value}
          variant="filled"
          autoFocus
          fullWidth
          margin="normal"
          label="Ask Qurator"
          helperText={helperText ?? DEFAULT_HELPER_TEXT}
          InputProps={{
            disableUnderline: true,
            classes: useInputStyles(),
            endAdornment: (
              <M.InputAdornment position="end">
                {model && <ModelPicker model={model} disabled={disabled} />}
                <M.IconButton
                  aria-label="Send"
                  disabled={disabled || !value}
                  onClick={handleSubmit}
                  type="submit"
                  edge="end"
                >
                  <M.Icon>send</M.Icon>
                </M.IconButton>
              </M.InputAdornment>
            ),
          }}
          InputLabelProps={{ classes: useLabelStyles() }}
          FormHelperTextProps={{ classes: { root: helperClass } }}
        />
      </M.ThemeProvider>
    </form>
  )
}
