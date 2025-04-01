import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  checkbox: {
    marginTop: t.spacing(0.5),
  },
  hintIcon: {
    color: t.palette.divider,
    fontSize: '1rem',
    marginLeft: '4px',
    verticalAlign: '-4px',
    '&:hover': {
      color: t.palette.text.secondary,
    },
  },
}))

interface KeywordWildcardFilterProps {
  value: string
  onChange: (v: string) => void
  strict: boolean
  onStrictChange: (v: boolean) => void
}

interface KeywordWildcardProps
  extends Omit<M.TextFieldProps, keyof KeywordWildcardFilterProps>,
    KeywordWildcardFilterProps {}

export default function KeywordWildcard({
  value,
  onChange,
  strict,
  onStrictChange,
  ...props
}: KeywordWildcardProps) {
  const classes = useStyles()

  const handleStrictChange = React.useCallback(
    (_event: unknown, checked: boolean) => {
      onStrictChange(checked)
    },
    [onStrictChange],
  )
  return (
    <>
      <M.TextField
        onChange={(event) => onChange(event.target.value)}
        size="small"
        value={value}
        variant="outlined"
        {...props}
      />
      <M.FormControlLabel
        className={classes.checkbox}
        control={
          <M.Checkbox checked={strict} onChange={handleStrictChange} size="small" />
        }
        label={
          <M.Typography variant="body2" color="textSecondary">
            Match whole term
            <M.Tooltip
              arrow
              title={
                <>
                  Strictly match the whole term instead of a substring, * and ? wildcards
                  are allowed
                </>
              }
            >
              <M.Icon className={classes.hintIcon}>help_outline</M.Icon>
            </M.Tooltip>
          </M.Typography>
        }
      />
    </>
  )
}
