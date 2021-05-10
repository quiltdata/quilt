import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import SubmitSpinner from 'containers/Bucket/PackageDialog/SubmitSpinner'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as validators from 'utils/validators'

import * as Form from './Form'

const useNavLinkEditorStyles = M.makeStyles((t) => ({
  section: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(1),
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    marginRight: t.spacing(2),
    overflow: 'hidden',
  },
  field: {
    display: 'flex',
  },
  fieldName: {
    ...t.typography.body2,
    flexShrink: 0,
    fontWeight: t.typography.fontWeightMedium,
    width: 50,
  },
  fieldValue: {
    ...t.typography.body2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progress: {
    marginLeft: t.spacing(1),
  },
  notConfigured: {
    ...t.typography.body1,
    marginRight: t.spacing(2),
  },
}))

function NavLinkEditor() {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()

  const { push } = Notifications.use()

  const classes = useNavLinkEditorStyles()

  const [editing, setEditing] = React.useState(false)
  const [formKey, setFormKey] = React.useState(1)
  const [removing, setRemoving] = React.useState(false)

  const edit = React.useCallback(() => {
    if (removing) return
    setEditing(true)
  }, [removing])

  const cancel = React.useCallback(() => {
    setEditing(false)
  }, [])

  const handleExited = React.useCallback(() => {
    // reset the form
    setFormKey(R.inc)
  }, [])

  const remove = React.useCallback(async () => {
    if (editing || removing || !settings?.customNavLink) return
    // XXX: implement custom MUI Dialog-based confirm?
    // eslint-disable-next-line no-restricted-globals, no-alert
    if (!confirm('You are about to remove custom link')) return
    setRemoving(true)
    try {
      await writeSettings(R.dissoc('customNavLink', settings))
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Error saving settings:')
      // eslint-disable-next-line no-console
      console.error(e)
      push("Couldn't save settings, see console for details")
    } finally {
      setRemoving(false)
    }
  }, [editing, removing, settings, writeSettings, push])

  const onSubmit = React.useCallback(
    async (values: { url: string; label: string }) => {
      try {
        await writeSettings({
          ...settings,
          customNavLink: { url: values.url, label: values.label },
        })
        setEditing(false)
        return undefined
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error saving settings:')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: "Couldn't save settings, see console for details" }
      }
    },
    [settings, writeSettings],
  )

  return (
    <>
      {settings?.customNavLink ? (
        <div className={classes.section}>
          <div className={classes.fields}>
            <div className={classes.field}>
              <div className={classes.fieldName}>URL:</div>
              <div className={classes.fieldValue}>{settings.customNavLink.url}</div>
            </div>
            <div className={classes.field}>
              <div className={classes.fieldName}>Label:</div>
              <div className={classes.fieldValue}>{settings.customNavLink.label}</div>
            </div>
          </div>
          <M.Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={edit}
            disabled={removing}
          >
            Edit
          </M.Button>
          <M.Box pl={1} />
          <M.Button color="primary" size="small" onClick={remove} disabled={removing}>
            Remove
          </M.Button>
          {removing && <M.CircularProgress size={24} className={classes.progress} />}
        </div>
      ) : (
        <div className={classes.section}>
          <div className={classes.notConfigured}>Not configured</div>
          <M.Button variant="outlined" color="primary" size="small" onClick={edit}>
            Add link
          </M.Button>
        </div>
      )}
      <M.Dialog open={editing} onExited={handleExited} fullWidth>
        <RF.Form onSubmit={onSubmit} key={formKey}>
          {({
            handleSubmit,
            submitting,
            submitFailed,
            submitError,
            error,
            hasValidationErrors,
          }) => (
            <>
              <M.DialogTitle>Configure custom link</M.DialogTitle>
              <M.DialogContent>
                <form onSubmit={handleSubmit}>
                  <RF.Field
                    component={Form.Field}
                    initialValue={settings?.customNavLink?.url || ''}
                    name="url"
                    label="URL"
                    placeholder="e.g. https://example.com/path"
                    validate={validators.required as FF.FieldValidator<string>}
                    errors={{
                      required: 'Enter URL to link to',
                    }}
                    disabled={submitting}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <M.Box pt={2} />
                  <RF.Field
                    component={Form.Field}
                    initialValue={settings?.customNavLink?.label || ''}
                    name="label"
                    label="Label"
                    placeholder="Enter link label"
                    validate={validators.required as FF.FieldValidator<string>}
                    errors={{
                      required: 'Enter link label',
                    }}
                    disabled={submitting}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <input type="submit" style={{ display: 'none' }} />
                </form>
              </M.DialogContent>
              <M.DialogActions>
                {submitting ? (
                  <SubmitSpinner />
                ) : (
                  (!!error || !!submitError) && (
                    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                      <M.Icon color="error">error_outline</M.Icon>
                      <M.Box pl={1} />
                      <M.Typography variant="body2" color="error">
                        {error || submitError}
                      </M.Typography>
                    </M.Box>
                  )
                )}

                <M.Button
                  type="submit"
                  onClick={handleSubmit}
                  variant="contained"
                  color="primary"
                  disabled={submitting || (submitFailed && hasValidationErrors)}
                >
                  Save
                </M.Button>
                <M.Button onClick={cancel} disabled={submitting}>
                  Cancel
                </M.Button>
              </M.DialogActions>
            </>
          )}
        </RF.Form>
      </M.Dialog>
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  sectionHeading: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
  },
}))

export default function Settings() {
  const classes = useStyles()
  return (
    <M.Box mt={2} mb={2}>
      <M.Paper>
        <M.Box px={3} pt={2} pb={1}>
          <M.Typography variant="h6">Catalog Customization</M.Typography>
        </M.Box>
        <M.Box px={3} pb={2}>
          <div className={classes.sectionHeading}>Custom navbar link</div>
          <React.Suspense fallback={<M.CircularProgress />}>
            <NavLinkEditor />
          </React.Suspense>
        </M.Box>
      </M.Paper>
    </M.Box>
  )
}
