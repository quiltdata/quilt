import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from '../requests'

interface WorkgroupSelectProps {
  onChange: (value: requests.athena.Workgroup | null) => void
  onLoadMore: (workgroups: requests.athena.WorkgroupsResponse) => void
  value: requests.athena.Workgroup | null
  workgroups: requests.athena.WorkgroupsResponse
}

const useStyles = M.makeStyles((t) => ({
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

const LOAD_MORE = 'load-more'

export default function WorkgroupSelect({
  workgroups,
  onChange,
  onLoadMore,
  value,
}: WorkgroupSelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === LOAD_MORE) {
        onLoadMore(workgroups)
      } else {
        onChange(
          workgroups.list.find((workgroup) => workgroup === event.target.value) || null,
        )
      }
    },
    [workgroups, onChange, onLoadMore],
  )

  return (
    <M.Paper>
      <M.FormControl className={classes.selectWrapper}>
        <M.Select
          classes={{ root: classes.select }}
          disabled={!workgroups.list.length}
          labelId="query-select"
          onChange={handleChange}
          value={value || 'none'}
        >
          {workgroups.list.map((name) => (
            <M.MenuItem key={name} value={name}>
              {name}
            </M.MenuItem>
          ))}
          {workgroups.next && (
            <M.MenuItem key={LOAD_MORE} value={LOAD_MORE}>
              <em>Load more</em>
            </M.MenuItem>
          )}
        </M.Select>
      </M.FormControl>
    </M.Paper>
  )
}
