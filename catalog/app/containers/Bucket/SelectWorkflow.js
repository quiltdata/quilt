import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {},

  spinner: {
    flex: 'none',
    marginRight: t.spacing(3),
  },

  crop: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
}))

const i18nMsgs = {
  label: 'Metadata quality workflow',
}

export default function SelectWorkflow({ className, disabled, items, onChange, value }) {
  const classes = useStyles()

  return (
    <div className={cx(classes.root, className)}>
      <M.FormControl disabled={disabled} fullWidth size="small">
        <M.InputLabel id="schema-select">{i18nMsgs.label}</M.InputLabel>
        <M.Select
          labelId="schema-select"
          value={value ? value.slug : ''}
          label={i18nMsgs.label}
        >
          {items.map((option) => (
            <M.MenuItem
              key={option.slug}
              value={option.slug}
              onClick={() => onChange(option)}
              dense
            >
              <M.ListItemText
                classes={{
                  primary: classes.crop,
                  secondary: classes.crop,
                }}
                primary={option.name}
                secondary={option.description}
              />
            </M.MenuItem>
          ))}
        </M.Select>
      </M.FormControl>
    </div>
  )
}
