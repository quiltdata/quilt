import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from './requests'

interface WorkgroupSelectProps {
  className?: string
  onChange: (value: requests.athena.Workgroup | null) => void
  onLoadMore: (workgroups: requests.athena.WorkgroupsResponse) => void
  value: requests.athena.Workgroup | null
  workgroups: requests.athena.WorkgroupsResponse
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

const LOAD_MORE = 'load-more'

export default function WorkgroupSelect({
  className,
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
          workgroups.list.find((workgroup) => workgroup.key === event.target.value) ||
            null,
        )
      }
    },
    [workgroups, onChange, onLoadMore],
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
            disabled={!workgroups.list.length}
            labelId="query-select"
            onChange={handleChange}
            value={value ? value.key : 'none'}
          >
            {workgroups.list.map((query) => (
              <M.MenuItem key={query.key} value={query.key}>
                {query.name}
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
      <M.FormHelperText>
        {!workgroups.list.length && 'There are no workgroups. '}
      </M.FormHelperText>
    </div>
  )
}
