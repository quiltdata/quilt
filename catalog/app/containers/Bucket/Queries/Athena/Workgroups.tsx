import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { docs } from 'constants/urls'
import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import { Alert, Section } from './Components'
import * as Model from './model'
import * as storage from './model/storage'

const useStyles = M.makeStyles((t) => ({
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

const LOAD_MORE = 'load-more'

interface WorkgroupSelectProps {
  bucket: string
  disabled?: boolean
  onLoadMore: (workgroups: Model.WorkgroupsResponse) => void
  value: Model.Workgroup | null
  workgroups: Model.WorkgroupsResponse
}

function WorkgroupSelect({
  bucket,
  disabled,
  onLoadMore,
  value,
  workgroups,
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
        storage.setWorkgroup(event.target.value)
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
          disabled={disabled || !workgroups.list.length}
          onChange={handleChange}
          value={value || 'none'}
        >
          {workgroups.list.map((name) => (
            <M.MenuItem key={name} value={name}>
              <M.ListItemText>{name}</M.ListItemText>
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

interface WorkgroupsEmptyProps {
  error?: Error
}

function WorkgroupsEmpty({ error }: WorkgroupsEmptyProps) {
  return (
    <>
      {error ? (
        <Alert title={error.name} error={error} />
      ) : (
        <Lab.Alert severity="info">
          <Lab.AlertTitle>
            No Athena workgroup available. Please ask an AWS Administrator to create one
            with an appropriate OutputLocation
          </Lab.AlertTitle>
        </Lab.Alert>
      )}

      <M.Box mt={1}>
        <M.Typography variant="body2">
          Check{' '}
          <StyledLink href={`${docs}/advanced/athena`}>Athena Queries docs</StyledLink> on
          setup and correct usage
        </M.Typography>
      </M.Box>
    </>
  )
}

interface AthenaWorkgroupsProps {
  bucket: string
}

export default function AthenaWorkgroups({ bucket }: AthenaWorkgroupsProps) {
  const { running, workgroup, workgroups } = Model.use()

  if (Model.isError(workgroups.data)) return <WorkgroupsEmpty error={workgroups.data} />
  if (Model.isError(workgroup.data)) return <WorkgroupsEmpty error={workgroup.data} />
  if (!Model.hasData(workgroups.data) || !Model.hasData(workgroup.data)) {
    return (
      <>
        <Skeleton height={24} width={128} animate />
        <Skeleton height={48} mt={1} animate />
      </>
    )
  }

  return (
    <Section title="Select workgroup" empty={<WorkgroupsEmpty />}>
      {workgroups.data.list.length && (
        <WorkgroupSelect
          disabled={running}
          bucket={bucket}
          onLoadMore={workgroups.loadMore}
          value={workgroup.data}
          workgroups={workgroups.data}
        />
      )}
    </Section>
  )
}
