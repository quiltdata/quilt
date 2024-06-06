import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import ME_QUERY from './gql/Me.generated'
import SWITCH_ROLE_MUTATION from './gql/SwitchRole.generated'

type Me = NonNullable<GQL.DataForDoc<typeof ME_QUERY>['me']>

const useRoleSwitcherStyles = M.makeStyles({
  content: {
    position: 'relative',
  },
  error: {
    borderRadius: 0,
  },
  errorIcon: {
    fontSize: '24px',
    marginLeft: '9px',
    marginRight: '23px',
  },
  progress: {
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.5)',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

interface RoleSwitcherProps {
  user: Me
  close: Dialogs.Close
}

function RoleSwitcher({ user, close }: RoleSwitcherProps) {
  const switchRole = GQL.useMutation(SWITCH_ROLE_MUTATION)
  const classes = useRoleSwitcherStyles()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const selectRole = React.useCallback(
    async (roleName: string) => {
      if (roleName === user.role.name) return close()
      setLoading(true)
      try {
        const { switchRole: r } = await switchRole({ roleName })
        switch (r.__typename) {
          case 'Me':
            window.location.reload()
            break
          case 'InvalidInput':
            const [e] = r.errors
            throw new Error(`InputError (${e.name}) at '${e.path}': ${e.message}`)
          case 'OperationError':
            throw new Error(`OperationError (${r.name}): ${r.message}`)
          default:
            assertNever(r)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error switching role', err)
        Sentry.captureException(err)
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError(`${err}`)
        }
        setLoading(false)
      }
    },
    [close, switchRole, user.role.name],
  )
  return (
    <>
      <M.DialogTitle>Switch role</M.DialogTitle>
      <div className={classes.content}>
        <M.Collapse in={!!error} mountOnEnter unmountOnExit>
          <Lab.Alert
            severity="error"
            classes={{ root: classes.error, icon: classes.errorIcon }}
          >
            <Lab.AlertTitle>Could not switch role</Lab.AlertTitle>
            Try again or contact support.
            <br />
            Error details:
            <br />
            {error}
          </Lab.Alert>
        </M.Collapse>
        <M.List disablePadding>
          {user.roles.map((role) => (
            <M.ListItem
              button
              key={role.name}
              onClick={() => selectRole(role.name)}
              selected={role.name === user.role.name}
            >
              <M.ListItemIcon>
                <M.Radio
                  checked={role.name === user.role.name}
                  tabIndex={-1}
                  disableRipple
                />
              </M.ListItemIcon>
              <M.ListItemText classes={{ primary: classes.name }}>
                {role.name}
              </M.ListItemText>
            </M.ListItem>
          ))}
        </M.List>
        {loading && (
          <div className={classes.progress}>
            <M.CircularProgress size={48} />
          </div>
        )}
      </div>
    </>
  )
}

const SWITCH_ROLES_DIALOG_PROPS = {
  maxWidth: 'sm' as const,
  fullWidth: true,
}

export default function useRoleSwitcher() {
  const openDialog = Dialogs.use()
  return (user: Me) =>
    openDialog(
      ({ close }) => <RoleSwitcher user={user} close={close} />,
      SWITCH_ROLES_DIALOG_PROPS,
    )
}
