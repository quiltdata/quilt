import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
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

  interface FormValues {
    role: string
  }

  const onSubmit = React.useCallback(
    async ({ role }: FormValues) => {
      if (role === user.role.name) {
        close()
        return new Promise(() => {}) // don't unlock the form controls
      }

      try {
        const { switchRole: r } = await switchRole({ roleName: role })
        switch (r.__typename) {
          case 'Me':
            window.location.reload()
            return await new Promise(() => {}) // don't unlock the form controls
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
        const message = err instanceof Error ? err.message : `${err}`
        return { [FF.FORM_ERROR]: message }
      }
    },
    [close, switchRole, user.role.name],
  )
  return (
    <RF.Form<FormValues> initialValues={{ role: user.role.name }} onSubmit={onSubmit}>
      {({ handleSubmit, submitting, submitError }) => (
        <>
          <M.DialogTitle>Switch role</M.DialogTitle>
          <M.Collapse in={!!submitError} mountOnEnter unmountOnExit>
            <div>
              <M.Divider />
              <Lab.Alert
                severity="error"
                classes={{ root: classes.error, icon: classes.errorIcon }}
              >
                <Lab.AlertTitle>Could not switch role</Lab.AlertTitle>
                Try again or contact support.
                <br />
                Error details:
                <br />
                {submitError}
              </Lab.Alert>
            </div>
          </M.Collapse>
          <M.Divider />
          <div className={classes.content}>
            <RF.Field<string> name="role">
              {(props) => (
                <M.List disablePadding>
                  {user.roles.map((role) => (
                    <M.ListItem
                      button
                      key={role.name}
                      onClick={() => props.input.onChange(role.name)}
                      selected={role.name === props.input.value}
                    >
                      <M.ListItemIcon>
                        <M.Radio
                          checked={role.name === props.input.value}
                          tabIndex={-1}
                          disableRipple
                        />
                      </M.ListItemIcon>
                      <M.ListItemText classes={{ primary: classes.name }}>
                        {role.name}
                        {role.name === user.role.name && (
                          <M.Box
                            component="span"
                            color="text.hint"
                            fontWeight="fontWeightLight"
                          >
                            &nbsp;(current)
                          </M.Box>
                        )}
                      </M.ListItemText>
                    </M.ListItem>
                  ))}
                </M.List>
              )}
            </RF.Field>
            {submitting && (
              <div className={classes.progress}>
                <M.CircularProgress size={48} />
              </div>
            )}
          </div>
          <M.Divider />
          <M.DialogActions>
            <M.Button onClick={close} disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              disabled={submitting}
              color="primary"
              variant="contained"
            >
              Switch
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
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
