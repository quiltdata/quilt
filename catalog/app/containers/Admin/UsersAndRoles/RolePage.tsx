import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'

import AccessTable, { AccessSummary } from './AccessTable'
import { roleAccess } from './access'
import { MAX_POLICIES_PER_ROLE, getArnLink } from './shared'

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
  },
  meta: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
  },
  arn: {
    ...t.typography.body2,
    // An ARN is machine-exact and read as identity here, so it takes mono.
    fontFamily: t.typography.monospace.fontFamily,
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
    overflowWrap: 'anywhere',
  },
  actions: {
    alignSelf: 'flex-start',
    display: 'flex',
    flex: '0 0 auto',
    gap: t.spacing(1),
    marginLeft: 'auto',
  },
}))

interface RoleHeaderProps {
  role: Role
  isDefault: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault?: () => void
}

function RoleHeader({
  role,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault,
}: RoleHeaderProps) {
  const classes = useHeaderStyles()
  const managed = role.__typename === 'ManagedRole'
  const arnLink = getArnLink(role.arn)
  return (
    <M.Paper className={classes.root} variant="outlined">
      <div className={classes.identity}>
        <M.Typography component="h1" className={classes.name}>
          {role.name}
        </M.Typography>
        <div className={classes.meta}>
          {managed
            ? 'Quilt creates and manages this IAM role, and its access comes from the policies attached below.'
            : 'You manage this IAM role in AWS. Quilt assigns it to users but cannot see or change what it grants.'}
          {isDefault && ' It is assigned to every new user.'}
        </div>
        <div className={classes.arn}>
          {arnLink ? <StyledLink href={arnLink}>{role.arn}</StyledLink> : role.arn}
        </div>
      </div>
      <div className={classes.actions}>
        <M.Button variant="outlined" onClick={onEdit}>
          Edit…
        </M.Button>
        {!isDefault && !!onSetDefault && (
          <M.Button variant="outlined" onClick={onSetDefault}>
            Make default…
          </M.Button>
        )}
        <M.Button variant="outlined" onClick={onDelete}>
          Delete…
        </M.Button>
      </div>
    </M.Paper>
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
  policies: {
    marginTop: t.spacing(1),
  },
  holders: {
    ...t.typography.body2,
    marginTop: t.spacing(0.5),
  },
}))

interface RolePageProps {
  role: Role
  isDefault: boolean
  /** Users holding this role, active or extra. */
  holders: readonly User[]
  onEdit: () => void
  onDelete: () => void
  onSetDefault?: () => void
}

// One page about the role: who holds it, what it reaches, and which policies account
// for that. The access table is the point — a role's level per bucket is a MAX()
// across its policies, which the old policy-count column could not show.
export default function RolePage({
  role,
  isDefault,
  holders,
  onEdit,
  onDelete,
  onSetDefault,
}: RolePageProps) {
  const classes = useStyles()
  const grants = React.useMemo(() => roleAccess(role), [role])
  const managed = role.__typename === 'ManagedRole'
  const policies = managed ? role.policies : []

  return (
    <>
      <div className={classes.block}>
        <RoleHeader
          role={role}
          isDefault={isDefault}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetDefault={onSetDefault}
        />
      </div>

      <M.Typography component="h2" className={classes.heading}>
        Who holds it
      </M.Typography>
      <M.Paper variant="outlined" className={classes.section}>
        {holders.length ? (
          <>
            <div className={classes.note}>
              {holders.length} {holders.length === 1 ? 'user holds' : 'users hold'} this
              role. Deleting it is refused while anyone still does.
            </div>
            <div className={classes.holders}>{holders.map((u) => u.name).join(', ')}</div>
          </>
        ) : (
          <div className={classes.note}>
            No user holds this role, so it grants nothing today.
          </div>
        )}
      </M.Paper>

      <M.Typography component="h2" className={classes.heading}>
        What it reaches
      </M.Typography>
      <M.Paper variant="outlined" className={classes.section}>
        {managed ? (
          <>
            <AccessSummary grants={grants} subject="This role" />
            <div className={classes.policies}>
              <AccessTable grants={grants} />
            </div>
          </>
        ) : (
          <div className={classes.note}>
            Access for a custom role is defined in the IAM policies you attached to it in
            AWS, which Quilt cannot read. Open the role in the AWS console to see what it
            grants.
          </div>
        )}
      </M.Paper>

      {managed && (
        <>
          <M.Typography component="h2" className={classes.heading}>
            Attached policies
          </M.Typography>
          <M.Paper variant="outlined" className={classes.section}>
            <div className={classes.note}>
              {policies.length} of {MAX_POLICIES_PER_ROLE} used. Access is the union of
              every attached policy, so attaching one can only add.
            </div>
            {policies.length ? (
              <M.List dense disablePadding>
                {policies.map((p) => (
                  <M.ListItem key={p.id} divider disableGutters>
                    <M.ListItemText
                      primary={p.title}
                      secondary={
                        p.managed
                          ? `${p.permissions.length} ${p.permissions.length === 1 ? 'bucket' : 'buckets'}`
                          : 'Set by ARN; Quilt cannot read what it grants'
                      }
                    />
                  </M.ListItem>
                ))}
              </M.List>
            ) : (
              <div className={classes.note}>None attached.</div>
            )}
          </M.Paper>
        </>
      )}
    </>
  )
}
