import * as React from 'react'
import * as M from '@material-ui/core'

// import { docs } from 'constants/urls'
// import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

interface WorkgroupSelectProps {
  className: string
  workgroups: requests.Workgroup[]
  onChange: (value: requests.Workgroup | null) => void
  value: requests.Workgroup | null
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
        Select query
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
            <M.MenuItem disabled value="none">
              Custom
            </M.MenuItem>
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
