import cx from 'classnames'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone, FileWithPath } from 'react-dropzone'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import SubmitSpinner from 'containers/Bucket/PackageDialog/SubmitSpinner'
// import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as validators from 'utils/validators'

const useInputColorStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    padding: '2px',
  },
  input: {
    flexGrow: 1,
    textAlign: 'center',
    marginLeft: t.spacing(2),
  },
  picker: {
    outlined: `1px solid ${t.palette.action.disabled}`,
    height: '40px',
    width: '50px',
  },
  pickerBlank: {
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
}))

type InputColorProps = M.TextFieldProps & {
  input: {
    value: string
    onChange: (value: string) => void
  }
}

function InputColor({ input: { value, onChange }, ...props }: InputColorProps) {
  const classes = useInputColorStyles()
  const handleChange = React.useCallback(
    (event) => onChange(event.target.value),
    [onChange],
  )
  return (
    <div className={classes.root}>
      <input
        className={cx(classes.picker, { [classes.pickerBlank]: !value })}
        onChange={handleChange}
        type="color"
        value={value && value.length === 7 ? value : props.placeholder}
      />
      <M.TextField
        className={classes.input}
        onChange={handleChange}
        size="small"
        value={value}
        variant="outlined"
        {...props}
      />
    </div>
  )
}

const useInputFileStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    outline: `2px dashed ${t.palette.primary.light}`,
    padding: '2px',
  },
  note: {
    flexGrow: 1,
    textAlign: 'center',
  },
  placeholder: {
    background: `1px solid ${t.palette.action.disabled}`,
    height: '50px',
    width: '50px',
  },
  preview: {
    height: '50px',
    width: '50px',
  },
}))

interface InputFileProps {
  input: {
    value: FileWithPath | string
    onChange: (value: FileWithPath) => void
  }
}

function InputFile({ input: { value, onChange } }: InputFileProps) {
  const classes = useInputFileStyles()
  const onDrop = React.useCallback(
    (files: FileWithPath[]) => {
      onChange(files[0])
    },
    [onChange],
  )
  const { getInputProps, getRootProps } = useDropzone({
    maxFiles: 1,
    onDrop,
  })
  const previewUrl = React.useMemo(() => {
    if (!value || typeof value === 'string') return null
    return URL.createObjectURL(value)
  }, [value])
  return (
    <div className={classes.root} {...getRootProps()}>
      <input {...getInputProps()} />
      {typeof value === 'string' && <img className={classes.preview} src={value} />}
      {!!previewUrl && <img className={classes.preview} src={previewUrl} />}
      {!value && <div className={classes.placeholder} />}
      <p className={classes.note}>Drop logo here</p>
    </div>
  )
}

const useThemeEditorStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(1),
  },
  field: {
    display: 'flex',
  },
  fieldName: {
    ...t.typography.body2,
    flexShrink: 0,
    fontWeight: t.typography.fontWeightMedium,
    width: 100,
  },
  fieldValue: {
    ...t.typography.body2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progress: {
    marginLeft: t.spacing(1),
  },
  notConfigured: {
    ...t.typography.body1,
    marginRight: t.spacing(2),
  },
}))

export default function ThemeEditor() {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()
  const uploadFile = CatalogSettings.useUploadFile()

  //   const { push } = Notifications.use()

  const classes = useThemeEditorStyles()

  const [editing, setEditing] = React.useState(false)
  const [formKey, setFormKey] = React.useState(1)
  const [removing] = React.useState(false)

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

  //   const remove = React.useCallback(async () => {
  //     if (editing || removing || !settings?.customNavLink) return
  //     // XXX: implement custom MUI Dialog-based confirm?
  //     // eslint-disable-next-line no-restricted-globals, no-alert
  //     if (!confirm('You are about to remove custom link')) return
  //     setRemoving(true)
  //     try {
  //       await writeSettings(R.dissoc('customNavLink', settings))
  //     } catch (e) {
  //       // eslint-disable-next-line no-console
  //       console.warn('Error saving settings:')
  //       // eslint-disable-next-line no-console
  //       console.error(e)
  //       push("Couldn't save settings, see console for details")
  //     } finally {
  //       setRemoving(false)
  //     }
  //   }, [editing, removing, settings, writeSettings, push])

  const onSubmit = React.useCallback(
    async (values: { logoUrl: string; primaryColor: string }) => {
      try {
        let logoUrl
        if (values?.logoUrl && typeof values?.logoUrl !== 'string') {
          logoUrl = await uploadFile(values.logoUrl)
        }
        const updatedSettings = settings || {}
        if (logoUrl) {
          updatedSettings.logo = {
            url: logoUrl,
          }
        }
        if (values.primaryColor) {
          updatedSettings.theme = {
            palette: {
              primary: {
                main: values.primaryColor,
              },
            },
          }
        } else {
          delete updatedSettings.theme
        }
        await writeSettings(updatedSettings)
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
        <>
          <div className={classes.field}>
            <div className={classes.fieldName}>Logo URL:</div>
            <div className={classes.fieldValue}>{settings.logo?.url}</div>
          </div>
          <div className={classes.field}>
            <div className={classes.fieldName}>Primary color:</div>
            <div className={classes.fieldValue}>
              {settings.theme?.palette?.primary?.main}
            </div>
          </div>
          <div className={classes.actions}>
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
            {/* <M.Button color="primary" size="small" onClick={remove} disabled={removing}>
              Remove
            </M.Button> */}
            {removing && <M.CircularProgress size={24} className={classes.progress} />}
          </div>
        </>
      ) : (
        <>
          <div className={classes.notConfigured}>Not configured</div>
          <div className={classes.actions}>
            <M.Button variant="outlined" color="primary" size="small" onClick={edit}>
              Configure link
            </M.Button>
          </div>
        </>
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
              <M.DialogTitle>Configure theme</M.DialogTitle>
              <M.DialogContent>
                <form onSubmit={handleSubmit}>
                  <RF.Field
                    component={InputFile}
                    initialValue={settings?.logo?.url || ''}
                    name="logoUrl"
                    label="Logo URL"
                    placeholder="e.g. https://example.com/path.jpg"
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
                    component={InputColor}
                    initialValue={settings?.theme?.palette?.primary?.main || ''}
                    name="primaryColor"
                    label="Background color"
                    placeholder="#282b50"
                    // validate={validators.required as FF.FieldValidator<string>}
                    errors={{
                      required: 'Enter background color',
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
