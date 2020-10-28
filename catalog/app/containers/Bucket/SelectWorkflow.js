import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import Skeleton from 'components/Skeleton'

import * as requests from './requests'

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
  label: 'Select workflow',
}

function SelectControl({ className, disabled, items, required, onChange }) {
  const classes = useStyles()

  const [value, setValue] = React.useState(items.find((item) => item.isDefault))

  React.useEffect(() => {
    if (!value || !onChange) return
    onChange(value)
  }, [onChange, value])

  return (
    <div className={cx(classes.root, className)}>
      <M.FormControl disabled={disabled} fullWidth size="small" variant="outlined">
        <M.InputLabel id="schema-select">{i18nMsgs.label}</M.InputLabel>
        <M.Select
          labelId="schema-select"
          value={value ? value.slug : ''}
          label={i18nMsgs.label}
        >
          {!required && (
            <M.MenuItem key="empty" value="empty" onClick={() => setValue(null)} dense>
              <M.ListItemText
                classes={{
                  primary: classes.crop,
                  secondary: classes.crop,
                }}
                primary="No workflow"
              />
            </M.MenuItem>
          )}

          {items.map((option) => (
            <M.MenuItem
              key={option.slug}
              value={option.slug}
              onClick={() => setValue(option)}
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

export default function SelectSchema({ className, bucket, onChange }) {
  const s3 = AWS.S3.use()

  const t = M.useTheme()

  const data = useData(requests.workflowsList, { s3, bucket })
  return data.case({
    Ok: (workflowsStruct) => (
      <SelectControl
        className={className}
        items={workflowsStruct.workflows}
        required={workflowsStruct.isRequired}
        onChange={onChange}
      />
    ),
    Err: () => <SelectControl className={className} items={[]} disabled />,
    _: () => <Skeleton height={t.spacing(4)} width={t.spacing(24)} />,
  })
}
