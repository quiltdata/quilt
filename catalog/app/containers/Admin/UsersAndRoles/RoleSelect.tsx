import cx from 'classnames'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

export interface Role {
  id: string
  name: string
}

export interface Value {
  selected: readonly Role[]
  active: Role | null
}

export const EMPTY_VALUE: Value = { selected: [], active: null }

export const validate: FF.FieldValidator<Value> = (v) => {
  if (!v.selected.length) return 'required'
  if (!v.active) return 'active'
}

export const ROLE_NAME_ASC = R.ascend((r: Role) => r.name)

const ITEM_HEIGHT = 46

const useRoleSelectStyles = M.makeStyles((t) => ({
  grid: {
    alignItems: 'center',
    display: 'grid',
    gap: t.spacing(1),
    grid: 'auto-flow / 1fr auto 1fr',
    marginTop: t.spacing(2),
  },
  list: ({ roles }: { roles: number }) => ({
    // show no less than 3 and no more than 4 and a half items
    height: `${ITEM_HEIGHT * R.clamp(3, 4.5, roles)}px`,
    overflowY: 'auto',
  }),
  listEmpty: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
  },
  availableRole: {
    paddingBottom: '5px',
    paddingTop: '5px',
  },
  defaultRole: {
    fontWeight: t.typography.fontWeightMedium,
    '&::after': {
      content: '"*"',
    },
  },
}))

interface RoleSelectProps extends RF.FieldRenderProps<Value> {
  roles: readonly Role[]
  defaultRole: Role | null
  nonEditable?: boolean
}

export function RoleSelect({
  roles,
  defaultRole,
  input: { value, onChange },
  meta,
  nonEditable,
}: RoleSelectProps) {
  const classes = useRoleSelectStyles({ roles: roles.length })

  const error = meta.submitFailed && meta.error
  const disabled = meta.submitting || meta.submitSucceeded || nonEditable

  const { active, selected } = value ?? EMPTY_VALUE

  const available = React.useMemo(
    () => roles.filter((r) => !selected.find((r2) => r2.id === r.id)).sort(ROLE_NAME_ASC),
    [roles, selected],
  )

  const add = (r: Role) =>
    onChange({
      selected: selected.concat(r).sort(ROLE_NAME_ASC),
      active: active ?? r,
    })

  const remove = (r: Role) => {
    const newSelected = selected.filter((r2) => r2.id !== r.id)
    let newActive: Role | null
    if (newSelected.length === 1) {
      // select the only available role
      newActive = newSelected[0]
    } else if (newSelected.find((r2) => r2.id === active?.id)) {
      // keep the active role if it's still available
      newActive = active
    } else {
      newActive = null
    }
    onChange({ selected: newSelected, active: newActive })
  }

  const activate = (r: Role) => onChange({ selected, active: r })

  const clear = () => onChange({ selected: [], active: null })

  function roleNameDisplay(r: Role) {
    if (r.id !== defaultRole?.id) return r.name
    return (
      <M.Tooltip title="Default role">
        <span className={classes.defaultRole}>{r.name}</span>
      </M.Tooltip>
    )
  }

  return (
    <M.FormControl error={!!error} margin="normal" fullWidth>
      {error ? (
        <M.Typography variant="body2" color="error">
          {error === 'required' ? 'Assign at least one role' : 'Select an active role'}
        </M.Typography>
      ) : (
        <M.Typography variant="body2" color="textSecondary">
          {nonEditable
            ? 'Roles assigned via role mapping and can be changed in config only'
            : 'User can assume any of the assigned roles'}
        </M.Typography>
      )}

      <div className={classes.grid}>
        <M.Card variant="outlined">
          <M.ListItem component="div" ContainerComponent="div" dense divider>
            <M.ListItemText
              primary="Assigned roles"
              secondary={`${selected.length} / ${roles.length} roles`}
              primaryTypographyProps={{ color: error ? 'error' : undefined }}
            />
            {!disabled && selected.length > 0 && (
              <M.ListItemSecondaryAction>
                <M.Tooltip title="Unassign all roles">
                  <M.IconButton onClick={clear} edge="end" size="small">
                    <M.Icon>clear_all</M.Icon>
                  </M.IconButton>
                </M.Tooltip>
              </M.ListItemSecondaryAction>
            )}
          </M.ListItem>
          {selected.length ? (
            <M.List dense disablePadding className={classes.list}>
              {selected.map((r) => (
                <M.ListItem
                  key={r.id}
                  selected={active?.id === r.id}
                  disabled={disabled}
                  button
                  onClick={() => activate(r)}
                >
                  <M.Tooltip
                    title={active?.id === r.id ? 'Active role' : 'Set active role'}
                  >
                    <M.Radio
                      checked={active?.id === r.id}
                      tabIndex={-1}
                      edge="start"
                      size="small"
                      disableRipple
                    />
                  </M.Tooltip>
                  <M.ListItemText primaryTypographyProps={{ noWrap: true }}>
                    {roleNameDisplay(r)}
                  </M.ListItemText>
                  {!disabled && (
                    <M.ListItemSecondaryAction>
                      <M.Tooltip title="Unassign role">
                        <M.IconButton edge="end" size="small" onClick={() => remove(r)}>
                          <M.Icon>close</M.Icon>
                        </M.IconButton>
                      </M.Tooltip>
                    </M.ListItemSecondaryAction>
                  )}
                </M.ListItem>
              ))}
            </M.List>
          ) : (
            <div className={cx(classes.list, classes.listEmpty)}>
              <M.Typography color={error ? 'error' : 'textSecondary'}>
                No roles assigned
              </M.Typography>
              {!!defaultRole && (
                <>
                  <M.Box pt={2} />
                  <M.Button
                    variant="contained"
                    color="primary"
                    onClick={() => add(defaultRole)}
                    disabled={disabled}
                  >
                    Assign default role
                  </M.Button>
                </>
              )}
            </div>
          )}
        </M.Card>

        <M.Icon color="action">sync_alt</M.Icon>

        <M.Card variant="outlined">
          <M.ListItem component="div" ContainerComponent="div" dense divider>
            <M.ListItemText
              primary="Available roles"
              secondary={`${roles.length - selected.length} / ${roles.length} roles`}
            />
          </M.ListItem>
          {available.length ? (
            <M.List dense disablePadding className={classes.list}>
              {available.map((r) => (
                <M.ListItem key={r.id} disabled={disabled} button onClick={() => add(r)}>
                  <M.ListItemText
                    className={classes.availableRole}
                    primaryTypographyProps={{ noWrap: true }}
                  >
                    {roleNameDisplay(r)}
                  </M.ListItemText>
                </M.ListItem>
              ))}
            </M.List>
          ) : (
            <div className={cx(classes.list, classes.listEmpty)}>
              <M.Typography color="textSecondary">All roles assigned</M.Typography>
            </div>
          )}
        </M.Card>
      </div>
    </M.FormControl>
  )
}
