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
}))

const i18nMsgs = {
  label: 'Select workflow',
}

function SelectControl({ className, items, onChange, disabled }) {
  const classes = useStyles()

  const [value, setValue] = React.useState(items.find((item) => item.isDefault))

  React.useEffect(() => {
    if (!value || !onChange) return
    onChange(value)
  }, [onChange, value])

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
              onClick={() => setValue(option)}
            >
              <M.ListItemText primary={option.name} secondary={option.description} />
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

  const data = useData(requests.schemasList, { s3, bucket })
  return data.case({
    Ok: (workflowsList) => (
      <SelectControl className={className} items={workflowsList} onChange={onChange} />
    ),
    Err: () => <SelectControl className={className} items={[]} disabled />,
    _: () => <Skeleton height={t.spacing(4)} width={t.spacing(24)} />,
  })
}
