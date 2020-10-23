import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import Skeleton from 'components/Skeleton'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(24),
  },

  spinner: {
    flex: 'none',
    marginRight: t.spacing(3),
  },
}))

const i18nMsgs = {
  label: 'Select schema',
}

function SelectControl({ className, items, onChange }) {
  const classes = useStyles()

  const [value, setValue] = React.useState(items.find((item) => item.isDefault))

  React.useEffect(() => onChange(value), [onChange, value])

  return (
    <M.FormControl
      className={cx(classes.root, className)}
      size="small"
      variant="outlined"
    >
      <M.InputLabel id="schema-select">{i18nMsgs.label}</M.InputLabel>
      <M.Select labelId="schema-select" value={value.slug} label={i18nMsgs.label}>
        {items.map((option) => (
          <M.MenuItem
            key={option.slug}
            value={option.slug}
            onClick={() => setValue(option)}
          >
            {option.title}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.FormControl>
  )
}

export default function SelectSchema({ className, bucket, onChange }) {
  const s3 = AWS.S3.use()

  const t = M.useTheme()

  const data = useData(requests.schemasList, { s3, bucket })
  return data.case({
    Ok: (schemasList) => (
      <SelectControl className={className} items={schemasList} onChange={onChange} />
    ),
    Err: () => null,
    _: () => <Skeleton height={t.spacing(4)} width={t.spacing(24)} />,
  })
}
