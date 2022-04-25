import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Model from 'model'
import StyledLink from 'utils/StyledLink'
import * as Types from 'utils/types'
import useQuery from 'utils/useQuery'

import BUCKETS_QUERY from './gql/Buckets.generated'

const NONE = 'None'

const useBucketPermissionStyles = M.makeStyles((t) => ({
  bucket: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  button: {
    marginLeft: t.spacing(1),
  },
  cell: {
    minWidth: t.spacing(17.5),
  },
  row: {
    '&:last-child $cell': {
      borderBottom: 0,
    },
  },
}))

interface BucketPermissionProps {
  bucket: string
  value: Model.GQLTypes.BucketPermissionLevel
  onChange: (bucket: string, value: Model.GQLTypes.BucketPermissionLevel) => void
  onRemove: (bucket: string) => void
}

function BucketPermissionEdit({
  bucket,
  value,
  onChange,
  onRemove,
}: BucketPermissionProps) {
  const classes = useBucketPermissionStyles()
  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === NONE) {
        onRemove(bucket)
        return
      }
      const level = Types.decode(Model.BucketPermissionLevelFromString)(
        event.target.value,
      )
      onChange(bucket, level)
    },
    [bucket, onRemove, onChange],
  )
  const levelStr = Model.BucketPermissionLevelFromString.encode(value)
  return (
    <M.TableRow className={classes.row}>
      <M.TableCell className={classes.cell}>
        <M.Typography className={classes.bucket} variant="body1">
          {bucket}
        </M.Typography>
      </M.TableCell>
      <M.TableCell className={classes.cell} align="right">
        <M.Select native value={levelStr} onChange={handleChange}>
          {Model.BucketPermissionLevelStrings.map((permission) => (
            <option key={permission}>{permission}</option>
          ))}
          <option>{NONE}</option>
        </M.Select>
      </M.TableCell>
    </M.TableRow>
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
  cell: {
    minWidth: t.spacing(17.5),
  },
  container: {
    borderBottom: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(1),
    maxHeight: 'calc(100vh - 500px)',
  },
}))

interface BucketPermissionsProps
  extends RF.FieldRenderProps<Model.GQLTypes.PermissionInput[]> {
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

  const bucketsData = useQuery({ query: BUCKETS_QUERY })

  const [anchorEl, setAnchorEl] = React.useState<Element | null>(null)

  const error = meta.submitFailed && (meta.error || meta.submitError)

  const bucketsIndices = React.useMemo(
    () =>
      value.reduce(
        (acc, { bucket }, idx) => ({ [bucket]: idx, ...acc }),
        {} as Record<string, number>,
      ),
    [value],
  )

  const handleChange = React.useCallback(
    (bucket: string, level: Model.GQLTypes.BucketPermissionLevel) => {
      const idx = bucketsIndices[bucket]
      if (idx == null) return
      onChange(R.adjust(idx, R.assoc('level', level), value))
    },
    [bucketsIndices, value, onChange],
  )

  const handleRemove = React.useCallback(
    (bucket: string) => {
      onChange(R.reject(R.propEq('bucket', bucket), value))
    },
    [value, onChange],
  )

  const handleOpen = React.useCallback(
    (e: React.MouseEvent) => {
      setAnchorEl(e.currentTarget)
    },
    [setAnchorEl],
  )

  const handleClose = React.useCallback(() => {
    setAnchorEl(null)
  }, [setAnchorEl])

  const handleAdd = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const bucket = e.currentTarget.dataset.name
      if (bucket) {
        onChange(
          value.concat([{ bucket, level: Model.GQLTypes.BucketPermissionLevel.READ }]),
        )
      }
      handleClose()
    },
    [value, onChange, handleClose],
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

      {/* TODO: sort? */}
      <M.TableContainer className={classes.container}>
        <M.Table stickyHeader size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>Bucket name</M.TableCell>
              <M.TableCell className={classes.cell} align="right">
                Permissions
              </M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {value.map(({ bucket, level }) => (
              <BucketPermissionEdit
                key={bucket}
                bucket={bucket}
                value={level}
                onChange={handleChange}
                onRemove={handleRemove}
              />
            ))}
            <M.TableRow>
              <M.TableCell>
                <M.Button onClick={handleOpen}>+ Add bucket</M.Button>
                <M.Menu
                  anchorEl={anchorEl}
                  keepMounted
                  open={!!anchorEl}
                  onClose={handleClose}
                >
                  {bucketsData.case({
                    // TODO: nicer fetching and error states
                    fetching: () => (
                      <M.MenuItem onClick={handleClose}>FETCHING</M.MenuItem>
                    ),
                    data: ({ buckets }) => {
                      const filtered = buckets.filter((b) => !(b.name in bucketsIndices))
                      return filtered.length ? (
                        filtered.map((b) => (
                          <M.MenuItem key={b.name} data-name={b.name} onClick={handleAdd}>
                            s3://{b.name}
                          </M.MenuItem>
                        ))
                      ) : (
                        <M.MenuItem onClick={handleClose}>No more buckets</M.MenuItem>
                      )
                    },
                    error: (e) => (
                      <M.MenuItem onClick={handleClose} title={e.message}>
                        ERROR
                      </M.MenuItem>
                    ),
                  })}
                </M.Menu>
              </M.TableCell>
            </M.TableRow>
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}
