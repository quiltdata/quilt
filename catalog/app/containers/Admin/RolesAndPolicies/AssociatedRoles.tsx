import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import useQuery from 'utils/useQuery'

import { MAX_POLICIES_PER_ROLE } from './shared'

import ROLES_QUERY from './gql/Roles.generated'
import { RoleSelection_ManagedRole_Fragment as ManagedRole } from './gql/RoleSelection.generated'

interface RoleSelectionDialogProps {
  open: boolean
  onClose: () => void
  roles: ManagedRole[]
  attachRoles: (roles: ManagedRole[]) => void
}

function RoleSelectionDialog({
  open,
  onClose,
  roles,
  attachRoles,
}: RoleSelectionDialogProps) {
  const [selected, setSelected] = React.useState<ManagedRole[]>([])
  const [committed, setCommitted] = React.useState(false)

  const handleExited = React.useCallback(() => {
    if (committed) attachRoles(selected)
    setCommitted(false)
    setSelected([])
  }, [attachRoles, committed, selected, setCommitted, setSelected])

  const handleAttach = React.useCallback(() => {
    setCommitted(true)
    onClose()
  }, [onClose, setCommitted])

  const toggle = React.useCallback(
    (role: ManagedRole) => {
      setSelected((value) =>
        value.includes(role) ? value.filter((r) => r.id !== role.id) : value.concat(role),
      )
    },
    [setSelected],
  )

  return (
    <M.Dialog maxWidth="xs" open={open} onClose={onClose} onExited={handleExited}>
      <M.DialogTitle>Attach policy to roles</M.DialogTitle>
      <M.DialogContent dividers>
        {roles.length ? (
          roles.map((role) => (
            <M.FormControlLabel
              key={role.id}
              style={{ display: 'flex', marginRight: 0 }}
              disabled={role.policies.length >= MAX_POLICIES_PER_ROLE}
              control={
                <M.Checkbox
                  checked={selected.includes(role)}
                  onChange={() => toggle(role)}
                  color="primary"
                />
              }
              label={
                <>
                  {role.name}{' '}
                  <M.Box component="span" color="text.secondary">
                    ({role.policies.length} / {MAX_POLICIES_PER_ROLE} policies)
                  </M.Box>
                </>
              }
            />
          ))
        ) : (
          <M.Typography>No more roles to attach this policy to</M.Typography>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button autoFocus onClick={onClose} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={handleAttach} disabled={!selected.length} color="primary">
          Attach
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface AssociatedRolesProps extends RF.FieldRenderProps<ManagedRole[]> {
  className?: string
}

export default function AssociatedRoles({
  className,
  input: { value, onChange },
  meta,
}: AssociatedRolesProps) {
  const error =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))

  const rolesData = useQuery({ query: ROLES_QUERY })

  const [roleSelectionOpen, setRoleSelectionOpen] = React.useState(false)

  const openRoleSelection = React.useCallback(() => {
    setRoleSelectionOpen(true)
  }, [setRoleSelectionOpen])

  const closeRoleSelection = React.useCallback(() => {
    setRoleSelectionOpen(false)
  }, [setRoleSelectionOpen])

  const attachRoles = React.useCallback(
    (roles: ManagedRole[]) => {
      onChange(value.concat(roles))
    },
    [onChange, value],
  )

  const detachRole = (role: ManagedRole) => {
    onChange(value.filter((r) => r.id !== role.id))
  }

  const availableRoles = React.useMemo(
    () =>
      rolesData.case({
        fetching: () => null,
        error: () => null,
        data: ({ roles }) => {
          const ids = value.reduce(
            (acc, { id }) => ({ ...acc, [id]: true }),
            {} as Record<string, boolean>,
          )
          return roles.filter(
            (r) => r.__typename === 'ManagedRole' && !ids[r.id],
          ) as ManagedRole[]
        },
      }),
    [rolesData, value],
  )

  return (
    <div className={className}>
      <M.Box display="flex" alignItems="center">
        <M.Typography variant="h6">Associated roles</M.Typography>
        {rolesData.case({
          data: () => null,
          fetching: () => (
            <M.Tooltip arrow title="Fetching roles">
              <M.CircularProgress size={20} style={{ opacity: 0.3, marginLeft: '8px' }} />
            </M.Tooltip>
          ),
          error: (e) => (
            <M.Tooltip arrow title={<>Error fetching roles: {e.message}</>}>
              <M.Icon style={{ opacity: 0.3, marginLeft: '8px' }}>error</M.Icon>
            </M.Tooltip>
          ),
        })}
      </M.Box>
      <M.Collapse in={!!error}>
        <M.FormHelperText error>{error || ' '}</M.FormHelperText>
      </M.Collapse>

      <M.List dense disablePadding>
        {value.map((role) => (
          // XXX: sort?
          // XXX: navigate to role on click?
          <M.ListItem key={role.id} divider disableGutters>
            <M.ListItemText>{role.name}</M.ListItemText>
            <M.ListItemSecondaryAction style={{ right: 0 }}>
              <M.Tooltip title="Detach current policy from this role">
                <M.IconButton onClick={() => detachRole(role)} edge="end" size="small">
                  <M.Icon fontSize="small">clear</M.Icon>
                </M.IconButton>
              </M.Tooltip>
            </M.ListItemSecondaryAction>
          </M.ListItem>
        ))}
        {!!availableRoles?.length && (
          <M.ListItem button disableGutters onClick={openRoleSelection}>
            <M.ListItemText>
              {!value.length && <>No associated roles. </>}
              Attach current policy to roles&hellip;
            </M.ListItemText>
          </M.ListItem>
        )}
      </M.List>
      {availableRoles && (
        <RoleSelectionDialog
          roles={availableRoles}
          open={roleSelectionOpen}
          onClose={closeRoleSelection}
          attachRoles={attachRoles}
        />
      )}
    </div>
  )
}
