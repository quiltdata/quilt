import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import useId from 'utils/useId'

const useStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
  },
  checkboxWrapper: {
    minWidth: t.spacing(4),
    paddingLeft: '2px',
  },
  label: {
    cursor: 'pointer',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  listItem: {
    padding: 0,
  },
}))

const KEYS = ['true', 'false'] as const

type Key = (typeof KEYS)[number]

type BooleanFilterValue = {
  [key in Key]: boolean
}

interface BooleanFilterProps {
  className?: string
  value: BooleanFilterValue
  onChange: (v: BooleanFilterValue) => void
}

export default function BooleanFilter({
  className,
  value,
  onChange,
}: BooleanFilterProps) {
  const classes = useStyles()
  const id = useId()
  const handleChange = React.useCallback(
    (key: Key, checked: boolean) => {
      onChange({ ...value, [key]: checked })
    },
    [onChange, value],
  )
  return (
    <div className={cx(classes.root, className)}>
      <M.List dense disablePadding>
        {KEYS.map((key) => (
          <M.ListItem key={key} disableGutters className={classes.listItem} button>
            <M.ListItemIcon className={classes.checkboxWrapper}>
              <M.Checkbox
                checked={value[key]}
                id={`${key}_${id}`}
                onChange={(event, checked) => handleChange(key, checked)}
                size="small"
              />
            </M.ListItemIcon>
            <M.ListItemText>
              <label className={classes.label} htmlFor={`${key}_${id}`}>
                {key}
              </label>
            </M.ListItemText>
          </M.ListItem>
        ))}
      </M.List>
    </div>
  )
}
