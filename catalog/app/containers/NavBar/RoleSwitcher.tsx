import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import ME_QUERY from './gql/Me.generated'
import SWITCH_ROLE_MUTATION from './gql/SwitchRole.generated'

type Me = NonNullable<GQL.DataForDoc<typeof ME_QUERY>['me']>

const useRoleSwitcherStyles = M.makeStyles((t) => ({
  progress: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing(4),
  },
}))

const useListItemTextStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0, 1),
  },
  primary: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

const LOADING = Symbol('loading')

interface RoleSwitcherProps {
  user: Me
  close: Dialogs.Close
}

function RoleSwitcher({ user, close }: RoleSwitcherProps) {
  const switchRole = GQL.useMutation(SWITCH_ROLE_MUTATION)
  const classes = useRoleSwitcherStyles()
  const textClasses = useListItemTextStyles()
  const [state, setState] = React.useState<Error | typeof LOADING | null>(null)
  const handleClick = React.useCallback(
    async (roleName: string) => {
      if (roleName === user.role.name) return close()
      setState(LOADING)
      try {
        const { switchRole: r } = await switchRole({ roleName })
        switch (r.__typename) {
          case 'Me':
            window.location.reload()
            break
          case 'InvalidInput':
          case 'OperationError':
            throw new Error('Failed to switch role. Try again')
          default:
            assertNever(r)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error switching role', err)
        if (err instanceof Error) {
          setState(err)
        } else {
          setState(new Error('Unexpected error switching role'))
        }
      }
    },
    [close, switchRole, user.role.name],
  )
  return (
    <>
      <M.DialogTitle>Switch role</M.DialogTitle>
      {state !== LOADING ? (
        <>
          {state instanceof Error && (
            <Lab.Alert severity="error">{state.message}</Lab.Alert>
          )}
          <M.List>
            {user.roles.map((role) => (
              <M.ListItem
                button
                key={role.name}
                onClick={() => handleClick(role.name)}
                selected={role.name === user.role.name}
              >
                <M.ListItemIcon>
                  <M.Radio
                    checked={role.name === user.role.name}
                    tabIndex={-1}
                    disableRipple
                  />
                </M.ListItemIcon>
                <M.ListItemText classes={textClasses}>{role.name}</M.ListItemText>
              </M.ListItem>
            ))}
          </M.List>
        </>
      ) : (
        <div className={classes.progress}>
          <M.CircularProgress size={48} />
        </div>
      )}
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
