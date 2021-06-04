import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

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
  onChange: (value: requests.BucketPermissionData) => void
  permissions: requests.Permission[]
  value: requests.BucketPermissionData
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
    <M.TableRow className={classes.row}>
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

const useStyles = M.makeStyles((t) => ({
  caption: {
    color: t.palette.text.secondary,
  },
  captionWrapper: {
    margin: t.spacing(0.5, 0, 0),
  },
  cell: {
    minWidth: t.spacing(17.5),
  },
  permissions: {
    marginTop: t.spacing(1),
  },
  scrollable: {
    border: `1px solid ${t.palette.divider}`,
    margin: t.spacing(2, 0, 0),
    maxHeight: '300px',
    overflow: 'auto',
  },
}))

interface BucketPermissionsProps {
  className: string
  input: {
    onChange: (value: requests.BucketsPermissionsData) => void
    value: requests.BucketsPermissionsData
  }
  onAdvanced: () => void
}

export default function BucketPermissions({
  className,
  input: { value, onChange },
  onAdvanced,
}: BucketPermissionsProps) {
  const classes = useStyles()

  const handleChange = React.useMemo(
    () => (index: number) => (bucketPermission: requests.BucketPermissionData) => {
      onChange(R.update(index, bucketPermission, value))
    },
    [value, onChange],
  )

  return (
    <div className={className}>
      <M.Typography variant="h6">Bucket access</M.Typography>
      <p className={classes.captionWrapper}>
        <M.Typography className={classes.caption} variant="caption">
          Manage access using per-bucket permissions or{' '}
          <StyledLink onClick={onAdvanced}>set existing role via ARN</StyledLink>
        </M.Typography>
      </p>

      <M.TableContainer className={classes.scrollable}>
        <M.Table size="small" className={classes.permissions}>
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>Bucket name</M.TableCell>
              <M.TableCell className={classes.cell}>Permissions</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {value.map((permission, index) => (
              <BucketPermissionEdit
                key={permission.bucket}
                permissions={['ReadWrite', 'Read', 'None']}
                value={permission}
                onChange={handleChange(index)}
              />
            ))}
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}
