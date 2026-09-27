import * as React from 'react'
import * as M from '@material-ui/core'

import * as Format from 'utils/format'

import AccessTable, { AccessSummary } from './AccessTable'
import { roleAccess, combinedAccess } from './access'

import { RoleSelectionFragment as Role } from './gql/RoleSelection.generated'
import { UserSelectionFragment as User } from './gql/UserSelection.generated'

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(2, 3),
    padding: t.spacing(2, 3),
  },
  identity: {
    flex: '1 1 320px',
    minWidth: 0,
  },
  name: {
    ...t.typography.h5,
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    overflowWrap: 'anywhere',
  },
  email: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
    overflowWrap: 'anywhere',
  },
  badge: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.secondary,
    lineHeight: 1.6,
    padding: t.spacing(0, 0.75),
  },
  admin: {
    borderColor: t.palette.warning.dark,
    color: t.palette.warning.dark,
  },
  actions: {
    alignSelf: 'flex-start',
    display: 'flex',
    flex: '0 0 auto',
    gap: t.spacing(1),
    marginLeft: 'auto',
  },
}))

interface UserHeaderProps {
  user: User
  isSelf: boolean
  onEditEmail: () => void
  onEditRoles: () => void
  onDelete: () => void
}

function UserHeader({
  user,
  isSelf,
  onEditEmail,
  onEditRoles,
  onDelete,
}: UserHeaderProps) {
  const classes = useHeaderStyles()
  return (
    <M.Paper className={classes.root} variant="outlined">
      <div className={classes.identity}>
        <M.Typography component="h1" className={classes.name}>
          {user.name}
          {user.isAdmin && (
            <span className={`${classes.badge} ${classes.admin}`}>Admin</span>
          )}
          {!user.isActive && <span className={classes.badge}>Disabled</span>}
          {user.isService && <span className={classes.badge}>Service</span>}
          {isSelf && <span className={classes.badge}>You</span>}
        </M.Typography>
        <div className={classes.email}>{user.email}</div>
      </div>
      <div className={classes.actions}>
        {!user.isService && (
          <M.Button variant="outlined" onClick={onEditEmail}>
            Change email…
          </M.Button>
        )}
        <M.Button variant="outlined" onClick={onEditRoles}>
          {user.isRoleAssignmentDisabled ? 'View roles…' : 'Assign roles…'}
        </M.Button>
        {!isSelf && !user.isService && (
          <M.Button variant="outlined" onClick={onDelete}>
            Delete…
          </M.Button>
        )}
      </div>
    </M.Paper>
  )
}

const useReadoutStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gap: t.spacing(2, 3),
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    padding: t.spacing(2, 3),
  },
  label: {
    ...t.typography.overline,
    color: t.palette.text.secondary,
    display: 'block',
  },
  value: {
    ...t.typography.body1,
    marginTop: t.spacing(0.5),
  },
  note: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    display: 'block',
    marginTop: t.spacing(0.5),
  },
}))

interface ReadoutProps {
  label: string
  value: React.ReactNode
  note: React.ReactNode
}

function Readout({ label, value, note }: ReadoutProps) {
  const classes = useReadoutStyles()
  return (
    <div>
      <span className={classes.label}>{label}</span>
      <div className={classes.value}>{value}</div>
      <span className={classes.note}>{note}</span>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  block: {
    marginTop: t.spacing(2),
  },
  heading: {
    ...t.typography.h6,
    marginBottom: t.spacing(1),
    marginTop: t.spacing(3),
  },
  section: {
    padding: t.spacing(2, 3),
  },
  note: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1.5),
  },
  roleRow: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
  },
  activeMark: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.primary.main}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.primary.main,
    lineHeight: 1.6,
    padding: t.spacing(0, 0.75),
  },
  tabs: {
    borderBottom: `1px solid ${t.palette.divider}`,
  },
}))

interface UserPageProps {
  user: User
  isSelf: boolean
  /** Full role records, so access can be read out; the user fragment carries only ids. */
  rolesById: Map<string, Role>
  onEditEmail: () => void
  onEditRoles: () => void
  onDelete: () => void
}

// One page about the user. The access section answers the question the table could
// not: a user assumes one role at a time, so the level in force depends on which
// role is active, and that is shown per role rather than as a single merged list.
export default function UserPage({
  user,
  isSelf,
  rolesById,
  onEditEmail,
  onEditRoles,
  onDelete,
}: UserPageProps) {
  const classes = useStyles()

  const held = React.useMemo(() => {
    const ids = [user.role, ...user.extraRoles].filter(Boolean).map((r) => r!.id)
    return ids.map((id) => rolesById.get(id)).filter((r): r is Role => !!r)
  }, [user.role, user.extraRoles, rolesById])

  const activeRole = user.role ? rolesById.get(user.role.id) : undefined
  const [tab, setTab] = React.useState(0)
  // The role list changes under the tabs when roles are reassigned; without this the
  // index can point past the end and the panel goes blank. The ceiling is
  // `held.length`, not `held.length - 1`: the last tab is "Any role", which sits one
  // past the per-role tabs and is otherwise unreachable.
  const safeTab = Math.min(tab, held.length)

  const activeGrants = React.useMemo(
    () => (activeRole ? roleAccess(activeRole) : []),
    [activeRole],
  )
  const anyGrants = React.useMemo(() => combinedAccess(held), [held])
  // `roleAccess` returns nothing for a custom IAM role because Quilt cannot read one,
  // which is not the same as the role reaching no bucket.
  const isCustom = (r: Role) => r.__typename !== 'ManagedRole'
  const activeUnknown = !!activeRole && isCustom(activeRole)

  return (
    <>
      <div className={classes.block}>
        <UserHeader
          user={user}
          isSelf={isSelf}
          onEditEmail={onEditEmail}
          onEditRoles={onEditRoles}
          onDelete={onDelete}
        />
      </div>

      <M.Typography component="h2" className={classes.heading}>
        Account
      </M.Typography>
      <M.Paper variant="outlined">
        <div className={useReadoutStyles().root}>
          <Readout
            label="Status"
            value={user.isActive ? 'Enabled' : 'Disabled'}
            note={
              user.isActive
                ? 'Can sign in and use the catalog.'
                : 'Cannot sign in. Roles are kept, so enabling restores the same access.'
            }
          />
          <Readout
            label="Admin"
            value={user.isAdmin ? 'Yes' : 'No'}
            note={
              user.isAdmin
                ? 'Can reach this page, add and remove users, and grant admin rights.'
                : 'Cannot reach the admin pages.'
            }
          />
          <Readout
            label="Joined"
            value={<Format.Relative value={user.dateJoined} />}
            note={user.dateJoined.toLocaleString()}
          />
          <Readout
            label="Last signed in"
            value={<Format.Relative value={user.lastLogin} />}
            note={user.lastLogin.toLocaleString()}
          />
        </div>
      </M.Paper>

      <M.Typography component="h2" className={classes.heading}>
        Roles
      </M.Typography>
      <M.Paper variant="outlined" className={classes.section}>
        {user.isRoleAssignmentDisabled && (
          <div className={classes.note}>
            {user.isService
              ? 'Roles for this service user are managed by the stack.'
              : 'Roles come from SSO role mapping and change in the SSO config, not here.'}
          </div>
        )}
        {held.length ? (
          <M.List dense disablePadding>
            {held.map((r) => (
              <M.ListItem key={r.id} divider disableGutters>
                <M.ListItemText
                  primary={
                    <span className={classes.roleRow}>
                      {r.name}
                      {r.id === user.role?.id && (
                        <span className={classes.activeMark}>Active</span>
                      )}
                    </span>
                  }
                  secondary={
                    r.__typename === 'ManagedRole'
                      ? `${r.permissions.length} ${r.permissions.length === 1 ? 'bucket' : 'buckets'}`
                      : 'Custom role; Quilt cannot read what it grants'
                  }
                />
              </M.ListItem>
            ))}
          </M.List>
        ) : (
          <div className={classes.note}>
            No role assigned, so this user reaches no bucket.
          </div>
        )}
      </M.Paper>

      <M.Typography component="h2" className={classes.heading}>
        What they can reach
      </M.Typography>
      <M.Paper variant="outlined" className={classes.section}>
        {!held.length ? (
          <div className={classes.note}>
            Nothing, until a role is assigned. Assigning one is what grants access.
          </div>
        ) : (
          <>
            <div className={classes.note}>
              A user assumes one role at a time, so only the active role&apos;s access is
              in force right now. The rest is reachable by switching role.
            </div>
            <AccessSummary
              grants={activeGrants}
              subject="The active role"
              unknown={activeUnknown}
            />
            {held.length > 1 ? (
              <>
                <M.Tabs
                  className={classes.tabs}
                  value={safeTab}
                  onChange={(_e, v) => setTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {held.map((r) => (
                    <M.Tab
                      key={r.id}
                      label={r.id === user.role?.id ? `${r.name} (active)` : r.name}
                    />
                  ))}
                  <M.Tab label="Any role" />
                </M.Tabs>
                {safeTab < held.length ? (
                  <AccessTable
                    grants={roleAccess(held[safeTab])}
                    unknown={isCustom(held[safeTab])}
                  />
                ) : (
                  <AccessTable
                    grants={anyGrants}
                    showRole
                    unknown={held.some(isCustom)}
                  />
                )}
              </>
            ) : (
              <AccessTable grants={activeGrants} unknown={activeUnknown} />
            )}
          </>
        )}
      </M.Paper>
    </>
  )
}
