import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'
import StyledLink from 'utils/StyledLink'
import * as Types from 'utils/types'

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
  value: Model.GQLTypes.BucketPermissionLevel | null
  onChange: (bucket: string, value: Model.GQLTypes.BucketPermissionLevel | null) => void
}

function BucketPermissionEdit({ bucket, value, onChange }: BucketPermissionProps) {
  const classes = useBucketPermissionStyles()
  const handleChange = React.useCallback(
    (event) => {
      const level = Types.decode(Model.NullableBucketPermissionLevelFromString)(
        event.target.value,
      )
      onChange(bucket, level)
    },
    [bucket, onChange],
  )
  const levelStr = Model.NullableBucketPermissionLevelFromString.encode(value)
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
  caption: {
    color: t.palette.text.secondary,
  },
  captionWrapper: {
    margin: t.spacing(0.5, 0, 0),
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

interface BucketPermissionsProps {
  className: string
  input: {
    value: Model.GQLTypes.PermissionInput[]
    onChange: (value: Model.GQLTypes.PermissionInput[]) => void
  }
  onAdvanced?: () => void
}

export default function BucketPermissions({
  className,
  input: { value, onChange },
  onAdvanced,
}: BucketPermissionsProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (bucket: string, level: Model.GQLTypes.BucketPermissionLevel | null) => {
      const idx = R.findIndex(R.propEq('bucket', bucket), value)
      onChange(R.adjust(idx, R.assoc('level', level), value))
    },
    [value, onChange],
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
              buckets according to their assigned role. Regular users can only see the
              buckets configured in their assigned role.
            </>
          }
        >
          <M.Icon fontSize="small" color="disabled" className={classes.icon}>
            info_outlined
          </M.Icon>
        </M.Tooltip>
      </div>
      {!!onAdvanced && (
        <p className={classes.captionWrapper}>
          <M.Typography className={classes.caption} variant="caption">
            Manage access using per-bucket permissions or{' '}
            <StyledLink onClick={onAdvanced}>set existing role via ARN</StyledLink>
          </M.Typography>
        </p>
      )}

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
              />
            ))}
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}
