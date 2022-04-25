import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import useQuery from 'utils/useQuery'

import ROLES_QUERY from './gql/Roles.generated'

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

interface AssociatedRolesProps extends RF.FieldRenderProps<string[]> {
  className?: string
  roleNames?: Record<string, string>
}

export default function AssociatedRoles({
  className,
  input: { value, onChange },
  meta,
  roleNames = {},
}: AssociatedRolesProps) {
  const classes = useStyles()

  const rolesData = useQuery({ query: ROLES_QUERY })

  const [anchorEl, setAnchorEl] = React.useState<Element | null>(null)

  const error = meta.submitFailed && (meta.error || meta.submitError)

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
      const roleId = e.currentTarget.dataset.role
      if (roleId) onChange(value.concat([roleId]))
      handleClose()
    },
    [value, onChange, handleClose],
  )

  const handleRemove = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const roleId = e.currentTarget.dataset.role
      if (roleId) onChange(R.without([roleId], value))
    },
    [value, onChange],
  )

  return (
    <div className={className}>
      <div className={classes.heading}>
        <M.Typography variant="h6">Associated roles</M.Typography>
        <M.Tooltip arrow title={<>TBD</>}>
          <M.Icon fontSize="small" color="disabled" className={classes.icon}>
            info_outlined
          </M.Icon>
        </M.Tooltip>
      </div>
      <M.Collapse in={!!error}>
        <M.FormHelperText error>{error || ' '}</M.FormHelperText>
      </M.Collapse>

      {/* TODO: sort? */}
      <M.TableContainer className={classes.container}>
        <M.Table stickyHeader size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>Role name</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {value.map((roleId) => (
              <M.TableRow key={roleId}>
                <M.TableCell>
                  {roleNames[roleId] ||
                    rolesData.case({
                      fetching: () => roleId,
                      error: () => roleId,
                      data: (d) => d.roles.find((r) => r.id === roleId)?.name || roleId,
                    })}
                  <M.Button data-role={roleId} onClick={handleRemove}>
                    Remove
                  </M.Button>
                </M.TableCell>
              </M.TableRow>
            ))}
            <M.TableRow>
              <M.TableCell>
                <M.Button onClick={handleOpen}>+ Add role</M.Button>
                <M.Menu
                  anchorEl={anchorEl}
                  keepMounted
                  open={!!anchorEl}
                  onClose={handleClose}
                >
                  {rolesData.case({
                    // TODO: nicer fetching and error states
                    fetching: () => (
                      <M.MenuItem onClick={handleClose}>FETCHING</M.MenuItem>
                    ),
                    data: ({ roles }) => {
                      const filtered = roles.filter(
                        (r) => r.__typename === 'ManagedRole' && !value.includes(r.id),
                      )
                      return filtered.length ? (
                        filtered.map((r) => (
                          <M.MenuItem key={r.id} data-role={r.id} onClick={handleAdd}>
                            {r.name}
                          </M.MenuItem>
                        ))
                      ) : (
                        <M.MenuItem onClick={handleClose}>No more roles</M.MenuItem>
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
