import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from './requests'

interface WorkgroupSelectProps {
  className?: string
  workgroups: requests.athena.Workgroup[]
  onChange: (value: requests.athena.Workgroup | null) => void
  value: requests.athena.Workgroup | null
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

export default function WorkgroupSelect({
  className,
  workgroups,
  onChange,
  value,
}: WorkgroupSelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      onChange(
        workgroups.find((workgroup) => workgroup.key === event.target.value) || null,
      )
    },
    [workgroups, onChange],
  )

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Select workgroup
      </M.Typography>
      <M.Paper>
        <M.FormControl className={classes.selectWrapper}>
          <M.Select
            classes={{ root: classes.select }}
            disabled={!workgroups.length}
            labelId="query-select"
            onChange={handleChange}
            value={value ? value.key : 'none'}
          >
            {workgroups.map((query) => (
              <M.MenuItem key={query.key} value={query.key}>
                {query.name}
              </M.MenuItem>
            ))}
          </M.Select>
        </M.FormControl>
      </M.Paper>
      <M.FormHelperText>
        {!workgroups.length && 'There are no workgroups. '}
      </M.FormHelperText>
    </div>
  )
}
