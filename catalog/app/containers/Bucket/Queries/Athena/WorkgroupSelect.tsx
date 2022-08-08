import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

// TODO: use it
// import SelectDropdown from 'components/SelectDropdown'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as requests from '../requests'

interface WorkgroupSelectProps {
  onLoadMore: (workgroups: requests.athena.WorkgroupsResponse) => void
  value: requests.athena.Workgroup | null
  workgroups: requests.athena.WorkgroupsResponse
  bucket: string
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
  bucket,
  workgroups,
  onLoadMore,
  value,
}: WorkgroupSelectProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const goToWorkgroup = React.useCallback(
    (workgroup: string) => {
      history.push(urls.bucketAthenaWorkgroup(bucket, workgroup))
    },
    [bucket, history, urls],
  )

  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === LOAD_MORE) {
        onLoadMore(workgroups)
      } else {
        goToWorkgroup(event.target.value)
      }
    },
    [goToWorkgroup, onLoadMore, workgroups],
  )

  return (
    <M.Paper>
      <M.FormControl className={classes.selectWrapper}>
        <M.Select
          classes={{ root: classes.select }}
          disabled={!workgroups.list.length}
          onChange={handleChange}
          value={value || 'none'}
        >
          {workgroups.list.map((name) => (
            <M.MenuItem key={name} value={name}>
              <RRDom.Link to={urls.bucketAthenaWorkgroup(bucket, name)}>
                <M.ListItemText>{name}</M.ListItemText>
              </RRDom.Link>
            </M.MenuItem>
          ))}
          {workgroups.next && (
            <M.MenuItem key={LOAD_MORE} value={LOAD_MORE}>
              <M.ListItemText>
                <em>Load more</em>
              </M.ListItemText>
            </M.MenuItem>
          )}
        </M.Select>
      </M.FormControl>
    </M.Paper>
  )
}
