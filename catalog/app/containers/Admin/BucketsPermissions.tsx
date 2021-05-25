import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'

type Permission = 'ReadWrite' | 'Read' | 'None'

interface BucketPermissionData {
  bucket: string
  permission: Permission
}

interface BucketsPermissionsData {
  permissions: BucketPermissionData[]
}

const useBucketPermissionStyles = M.makeStyles((t) => ({
  cell: {
    '&:first-child': {
      paddingLeft: 0,
    },
    '&:last-child': {
      paddingRight: 0,
    },
  },
  bucket: {
    lineHeight: `${t.spacing(6)}px`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  button: {
    marginLeft: t.spacing(1),
  },
}))

interface BucketPermissionProps {
  onChange: (value: BucketPermissionData) => void
  permissions: Permission[]
  value: BucketPermissionData
}

function BucketPermissionEdit({ onChange, permissions, value }: BucketPermissionProps) {
  const classes = useBucketPermissionStyles()
  const handleChange = React.useCallback(
    (event) => {
      const permission = event.target.value
      onChange(R.assoc('permission', permission, value))
    },
    [value, onChange],
  )
  return (
    <M.TableRow>
      <M.TableCell className={classes.cell}>
        <M.Typography className={classes.bucket} variant="body1">
          {value.bucket}
        </M.Typography>
      </M.TableCell>
      <M.TableCell className={classes.cell}>
        <M.Select native value={value.permission} onChange={handleChange}>
          {permissions.map((permission) => (
            <option key={permission}>{permission}</option>
          ))}
        </M.Select>
      </M.TableCell>
    </M.TableRow>
  )
}

interface BucketPermissionsProps {
  className: string
  input: {
    onChange: (value: BucketsPermissionsData) => void
    value: BucketsPermissionsData
  }
  onAdvanced: () => void
}

const useStyles = M.makeStyles((t) => ({
  caption: {
    color: t.palette.text.secondary,
  },
  captionWrapper: {
    margin: t.spacing(0.5, 0, 0),
  },
  cell: {
    '&:first-child': {
      paddingLeft: 0,
    },
    '&:last-child': {
      paddingRight: 0,
    },
  },
  permissions: {
    marginTop: t.spacing(1),
  },
}))

export default function BucketPermissions({
  className,
  input,
  onAdvanced,
}: BucketPermissionsProps) {
  const { value, onChange } = input

  const classes = useStyles()

  const handleChange = React.useMemo(
    () => (index: number) => (bucketPermission: BucketPermissionData) => {
      onChange(
        R.assoc(
          'permissions',
          R.update(index, bucketPermission, value.permissions),
          value,
        ),
      )
    },
    [value, onChange],
  )

  return (
    <div className={className}>
      <M.Typography variant="subtitle2">Bucket access</M.Typography>
      <p className={classes.captionWrapper}>
        <M.Typography className={classes.caption} variant="caption">
          Manage access using per-bucket permissions or{' '}
          <StyledLink onClick={onAdvanced}>set existing role via ARN</StyledLink>
        </M.Typography>
      </p>

      <M.Table size="small" className={classes.permissions}>
        <M.TableHead>
          <M.TableRow>
            <M.TableCell className={classes.cell}>Bucket name</M.TableCell>
            <M.TableCell className={classes.cell}>Permissions</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {value.permissions.map((permission, index) => (
            <BucketPermissionEdit
              key={permission.bucket}
              permissions={['ReadWrite', 'Read', 'None']}
              value={permission}
              onChange={handleChange(index)}
            />
          ))}
        </M.TableBody>
      </M.Table>
    </div>
  )
}
