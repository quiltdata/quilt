import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'
import type { Value } from './types'

const ES_V = '6.8'
const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-wildcard-query.html`

const useStyles = M.makeStyles((t) => ({
  input: {
    background: t.palette.background.paper,
  },
  checkbox: {
    marginTop: t.spacing(0.5),
  },
  hintIcon: {
    color: t.palette.divider,
    fontSize: '1rem',
    marginLeft: '4px',
    verticalAlign: '-2px',
    '&:hover': {
      color: t.palette.text.secondary,
    },
  },
}))

interface KeywordWildcardFilterProps {
  value: { wildcard: string; strict: boolean }
  onChange: (v: Value<{ wildcard: string; strict: boolean }>) => void
}

interface KeywordWildcardProps
  extends Omit<M.TextFieldProps, keyof KeywordWildcardFilterProps>,
    KeywordWildcardFilterProps {}

export default function KeywordWildcard({
  className,
  value,
  onChange,
  ...props
}: KeywordWildcardProps) {
  const classes = useStyles()

  const [wildcard, setWildcard] = React.useState(value.wildcard)
  const [strict, setStrict] = React.useState(value.strict)

  const handleWildcardChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value
      setWildcard(newValue)
      onChange({ strict, wildcard: newValue })
    },
    [onChange, strict],
  )
  const handleStrictChange = React.useCallback(
    (_event: unknown, checked: boolean) => {
      setStrict(checked)
      onChange({ strict: checked, wildcard })
    },
    [onChange, wildcard],
  )
  return (
    <>
      <M.TextField
        className={cx(classes.input, className)}
        onChange={handleWildcardChange}
        size="small"
        value={wildcard}
        variant="outlined"
        {...props}
      />
      <M.FormHelperText>
        Refer to{' '}
        <StyledLink to={ES_REF} target="_blank">
          documentation
        </StyledLink>{' '}
        on Wildcard Queries
      </M.FormHelperText>
      <M.FormControlLabel
        className={classes.checkbox}
        control={
          <M.Checkbox checked={strict} onChange={handleStrictChange} size="small" />
        }
        label={
          <M.Typography variant="body2" color="textSecondary" component="span">
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
