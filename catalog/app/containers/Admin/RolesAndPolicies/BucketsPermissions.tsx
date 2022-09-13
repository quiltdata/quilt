import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import defaultBucketIcon from 'components/BucketIcon/bucket.svg'
import * as Model from 'model'
import StyledLink from 'utils/StyledLink'
import useQuery from 'utils/useQuery'

import BUCKETS_QUERY from './gql/Buckets.generated'
import { BucketPermissionSelectionFragment as BucketPermission } from './gql/BucketPermissionSelection.generated'

const Level = Model.GQLTypes.BucketPermissionLevel
// eslint-disable-next-line @typescript-eslint/no-redeclare
type Level = Model.GQLTypes.BucketPermissionLevel

type Bucket = BucketPermission['bucket']

interface BucketAddDialogProps {
  open: boolean
  onClose: () => void
  buckets: Bucket[]
  addBucket: (bucket: Bucket) => void
}

function BucketAddDialog({ open, onClose, buckets, addBucket }: BucketAddDialogProps) {
  const [selected, select] = React.useState<Bucket | null>(null)

  const handleExited = React.useCallback(() => {
    if (selected) addBucket(selected)
    select(null)
  }, [addBucket, selected, select])

  const handleAdd = React.useCallback(
    (bucket: Bucket) => {
      select(bucket)
      onClose()
    },
    [onClose, select],
  )

  return (
    <M.Dialog maxWidth="xs" open={open} onClose={onClose} onExited={handleExited}>
      <M.DialogTitle>Add a bucket</M.DialogTitle>
      {buckets.length ? (
        <M.List>
          {buckets.map((bucket) => (
            <M.ListItem key={bucket.name} button onClick={() => handleAdd(bucket)}>
              <M.ListItemAvatar style={{ minWidth: 44 }}>
                <M.Avatar
                  style={{ width: 32, height: 32 }}
                  src={bucket.iconUrl || defaultBucketIcon}
                />
              </M.ListItemAvatar>
              <M.ListItemText>
                s3://{bucket.name}{' '}
                <M.Box component="span" color="text.secondary" ml={0.5}>
                  {bucket.title}
                </M.Box>
              </M.ListItemText>
            </M.ListItem>
          ))}
        </M.List>
      ) : (
        <M.DialogContent>
          <M.Typography>No more buckets to add</M.Typography>
        </M.DialogContent>
      )}
      <M.DialogActions>
        <M.Button autoFocus onClick={onClose} color="primary">
          Cancel
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const useStyles = M.makeStyles((t) => ({
  heading: {
    alignItems: 'center',
    display: 'flex',
  },
  icon: {
    marginLeft: t.spacing(0.5),
  },
}))

interface BucketPermissionsProps extends RF.FieldRenderProps<BucketPermission[]> {
  className?: string
  errors: Record<string, string>
  onAdvanced?: () => void
}

export default function BucketsPermissions({
  className,
  input: { value, onChange },
  meta,
  errors,
  onAdvanced,
}: BucketPermissionsProps) {
  const classes = useStyles()

  const error =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))

  const bucketsData = useQuery({ query: BUCKETS_QUERY })

  const [permissionMenuState, setPermissionMenuState] = React.useState<{
    anchorEl: HTMLElement
    perm: BucketPermission
  } | null>(null)

  const openPermissionMenu = (
    event: React.MouseEvent<HTMLElement>,
    perm: BucketPermission,
  ) => {
    setPermissionMenuState({ anchorEl: event.currentTarget, perm })
  }

  const closePermissionMenu = () => {
    setPermissionMenuState(null)
  }

  const setBucketPermission = (level: Level | null) => () => {
    const { bucket } = permissionMenuState?.perm ?? {}
    if (bucket) {
      onChange(
        level
          ? value.map((perm) =>
              perm.bucket.name === bucket.name ? { ...perm, bucket, level } : perm,
            )
          : value.filter((perm) => perm.bucket.name !== bucket.name),
      )
    }
    closePermissionMenu()
  }

  const [bucketAdditionOpen, setBucketAdditionOpen] = React.useState(false)

  const openBucketAddition = React.useCallback(() => {
    setBucketAdditionOpen(true)
  }, [setBucketAdditionOpen])

  const closeBucketAddition = React.useCallback(() => {
    setBucketAdditionOpen(false)
  }, [setBucketAdditionOpen])

  const addBucket = React.useCallback(
    (bucket: Bucket) => {
      onChange(
        value.concat({ __typename: 'PolicyBucketPermission', bucket, level: Level.READ }),
      )
    },
    [onChange, value],
  )

  const availableBuckets = React.useMemo(
    () =>
      bucketsData.case({
        fetching: () => null,
        error: () => null,
        data: ({ buckets }) => {
          const names = value.reduce(
            (acc, { bucket: { name } }) => ({ ...acc, [name]: true }),
            {} as Record<string, boolean>,
          )
          return buckets.filter((b) => !names[b.name])
        },
      }),
    [bucketsData, value],
  )

  return (
    <div className={className}>
      <div className={classes.heading}>
        <M.Typography variant="h6">Bucket access</M.Typography>
        <M.Tooltip
          arrow
          title={
            <>
              Admin users can see all the buckets, but can only access the contents of the
              buckets according to their assigned role (policies). Regular users can only
              see the buckets configured in their assigned role (policies).
            </>
          }
        >
          <M.Icon fontSize="small" color="disabled" className={classes.icon}>
            info_outlined
          </M.Icon>
        </M.Tooltip>
        {bucketsData.case({
          data: () => null,
          fetching: () => (
            <M.Tooltip arrow title="Fetching buckets">
              <M.CircularProgress
                size={20}
                style={{ opacity: 0.3 }}
                className={classes.icon}
              />
            </M.Tooltip>
          ),
          error: (e) => (
            <M.Tooltip arrow title={<>Error fetching buckets: {e.message}</>}>
              <M.Icon fontSize="small" color="disabled" className={classes.icon}>
                error
              </M.Icon>
            </M.Tooltip>
          ),
        })}
      </div>
      {!!onAdvanced && (
        <M.FormHelperText>
          Manage access using per-bucket permissions or{' '}
          <StyledLink onClick={onAdvanced}>set existing policy via ARN</StyledLink>
        </M.FormHelperText>
      )}
      <M.Collapse in={!!error}>
        <M.FormHelperText error>{error ? errors[error] || error : ' '}</M.FormHelperText>
      </M.Collapse>

      <M.List dense disablePadding>
        {value.map((perm) => (
          // XXX: navigate to bucket on click?
          <M.ListItem
            key={perm.bucket.name}
            disableGutters
            button
            onClick={(event) => openPermissionMenu(event, perm)}
          >
            <M.ListItemAvatar style={{ minWidth: 44 }}>
              <M.Avatar
                style={{ width: 32, height: 32 }}
                src={perm.bucket.iconUrl || defaultBucketIcon}
              />
            </M.ListItemAvatar>
            <M.ListItemText
              primary={
                <>
                  s3://{perm.bucket.name}{' '}
                  <M.Box component="span" color="text.secondary" ml={0.5}>
                    {perm.bucket.title}
                  </M.Box>
                </>
              }
            />
            <M.ListItemSecondaryAction style={{ right: 0 }}>
              <M.Tooltip
                title={`Read-${perm.level === Level.READ ? 'only' : 'write'} access`}
              >
                <M.IconButton
                  onClick={(event) => openPermissionMenu(event, perm)}
                  edge="end"
                  size="small"
                >
                  <M.Icon>{perm.level === Level.READ ? 'visibility' : 'edit'}</M.Icon>
                </M.IconButton>
              </M.Tooltip>
            </M.ListItemSecondaryAction>
          </M.ListItem>
        ))}
        {!!availableBuckets?.length && (
          <M.ListItem button disableGutters onClick={openBucketAddition}>
            <M.ListItemAvatar style={{ minWidth: 44 }}>
              <M.Avatar style={{ width: 32, height: 32 }}>
                <M.Icon>add</M.Icon>
              </M.Avatar>
            </M.ListItemAvatar>
            <M.ListItemText>
              {!value.length && <>No buckets selected. </>}
              Add a bucket&hellip;
            </M.ListItemText>
          </M.ListItem>
        )}
      </M.List>

      {availableBuckets && (
        <BucketAddDialog
          buckets={availableBuckets}
          open={bucketAdditionOpen}
          onClose={closeBucketAddition}
          addBucket={addBucket}
        />
      )}

      <M.Menu
        anchorEl={permissionMenuState?.anchorEl}
        keepMounted
        open={!!permissionMenuState?.anchorEl}
        onClose={closePermissionMenu}
      >
        <M.MenuItem
          onClick={setBucketPermission(Level.READ)}
          selected={permissionMenuState?.perm.level === Level.READ}
        >
          <M.Icon>visibility</M.Icon>&nbsp;&nbsp;Read-only access
        </M.MenuItem>
        <M.MenuItem
          onClick={setBucketPermission(Level.READ_WRITE)}
          selected={permissionMenuState?.perm.level === Level.READ_WRITE}
        >
          <M.Icon>edit</M.Icon>&nbsp;&nbsp;Read-write access
        </M.MenuItem>
        <M.MenuItem onClick={setBucketPermission(null)}>
          <M.Icon>clear</M.Icon>&nbsp;&nbsp;No access
        </M.MenuItem>
      </M.Menu>
    </div>
  )
}
