import cx from 'classnames'
import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone, FileWithPath } from 'react-dropzone'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import SubmitSpinner from 'containers/Bucket/PackageDialog/SubmitSpinner'
import * as Notifications from 'containers/Notifications'
import Logo from 'components/Logo'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as validators from 'utils/validators'

import * as Form from '../Form'

const useInputColorStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'flex-start',
    display: 'flex',
    padding: '2px',
  },
  input: {
    flexGrow: 1,
    textAlign: 'center',
    marginLeft: t.spacing(2),
  },
  picker: {
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

type InputColorProps = Partial<M.TextFieldProps> & {
  input: {
    value: string
    onChange: (value: string) => void
  }
  errors: Record<string, React.ReactNode>
  meta: RF.FieldMetaState<string>
}

function InputColor({
  errors,
  meta,
  input: { value, onChange },
  ...props
}: InputColorProps) {
  const error = meta.submitFailed && (meta.error || meta.submitError)
  const classes = useInputColorStyles()
  const handleChange = React.useCallback(
    (event) => onChange(event.target.value),
    [onChange],
  )
  const isValidHex = React.useMemo(
    () => value && value.length === 7 && !validators.hexColor(value),
    [value],
  )
  return (
    <div className={classes.root}>
      <input
        className={cx(classes.picker, { [classes.pickerBlank]: !value })}
        onChange={handleChange}
        type="color"
        value={isValidHex ? value : props.placeholder}
      />
      <M.TextField
        className={classes.input}
        error={!!error}
        helperText={error ? errors[error] || error : null}
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
    alignItems: 'center',
    border: `1px solid ${t.palette.action.disabled}`,
    display: 'flex',
    height: '50px',
    justifyContent: 'center',
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
      {!!value && typeof value === 'string' && (
        <Logo src={value} height="50px" width="50px" />
      )}
      {!!previewUrl && <img className={classes.preview} src={previewUrl} />}
      {!value && (
        <div className={classes.placeholder}>
          <M.Icon>hide_image</M.Icon>
        </div>
      )}
      <p className={classes.note}>Drop logo here</p>
    </div>
  )
}

const useThemePreviewStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    margin: t.spacing(1, 0, 0),
  },
  inner: {
    ...t.typography.body2,
    minWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoWrapper: {
    padding: t.spacing(1),
    backgroundColor: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor || '#282b50',
    alignItems: 'center',
    display: 'flex',
    height: '46px',
    justifyContent: 'center',
  },
  logo: {
    color: '#fff',
    maxHeight: '100%',
    maxWidth: '100%',
  },
}))

interface ThemePreviewProps {}

function ThemePreview({}: ThemePreviewProps) {
  const settings = CatalogSettings.use()
  const classes = useThemePreviewStyles({
    backgroundColor: settings?.theme?.palette?.primary?.main,
  })
  return (
    <div className={classes.root}>
      <div className={cx(classes.inner, classes.logoWrapper)}>
        {settings?.logo?.url ? (
          <Logo
            height="46px"
            width="46px"
            className={classes.logo}
            src={settings?.logo?.url}
          />
        ) : (
          <M.Icon className={classes.logo}>hide_image</M.Icon>
        )}
      </div>
    </div>
  )
}

const useThemeEditorStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(1),
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

  const { push } = Notifications.use()

  const classes = useThemeEditorStyles({
    backgroundColor: settings?.theme?.palette?.primary?.main,
  })

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
    if (editing || removing || (!settings?.theme && !settings?.logo)) return
    // XXX: implement custom MUI Dialog-based confirm?
    // eslint-disable-next-line no-restricted-globals, no-alert
    if (!confirm('You are about to remove custom theme')) return
    setRemoving(true)
    try {
      await writeSettings(FP.function.pipe(settings, R.dissoc('theme'), R.dissoc('logo')))
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
    async (values: { logoUrl: string; primaryColor: string }) => {
      try {
        let logoUrl = values?.logoUrl
        // TODO: check is instance of File explicitly
        if (logoUrl && typeof logoUrl !== 'string') {
          logoUrl = await uploadFile(logoUrl)
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
    [settings, writeSettings, uploadFile],
  )

  // FIXME: remove when file upload would be ready
  const useThirdPartyDomainForLogo = true

  return (
    <>
      {settings?.theme || settings?.logo ? (
        <>
          <ThemePreview />

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
            <M.Button color="primary" size="small" onClick={remove} disabled={removing}>
              Remove
            </M.Button>
            {removing && <M.CircularProgress size={24} className={classes.progress} />}
          </div>
        </>
      ) : (
        <>
          <div className={classes.notConfigured}>Not configured</div>
          <div className={classes.actions}>
            <M.Button variant="outlined" color="primary" size="small" onClick={edit}>
              Configure theme
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
                  {useThirdPartyDomainForLogo ? (
                    <RF.Field
                      component={Form.Field}
                      initialValue={settings?.logo?.url || ''}
                      name="logoUrl"
                      label="Logo URL"
                      placeholder="e.g. https://example.com/path.jpg"
                      validate={validators.url as FF.FieldValidator<string>}
                      errors={{
                        url: 'Image should be valid url',
                      }}
                      disabled={submitting}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  ) : (
                    <RF.Field
                      component={InputFile}
                      initialValue={settings?.logo?.url || ''}
                      name="logoUrl"
                      label="Logo URL"
                      placeholder="e.g. https://example.com/path.jpg"
                      validate={
                        validators.composeOr(
                          validators.file,
                          validators.url,
                        ) as FF.FieldValidator<string>
                      }
                      errors={{
                        url: 'Image should be valid url',
                        file: 'Image should be file',
                      }}
                      disabled={submitting}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                  <M.Box pt={2} />
                  <RF.Field
                    // @ts-expect-error
                    component={InputColor}
                    initialValue={settings?.theme?.palette?.primary?.main || ''}
                    name="primaryColor"
                    label="Background color"
                    placeholder="#282b50"
                    validate={validators.hexColor as FF.FieldValidator<string>}
                    errors={{
                      hex: 'Enter 6-digit hex color, ex. #282b50',
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

                <M.Button onClick={cancel} disabled={submitting}>
                  Cancel
                </M.Button>
                <M.Button
                  type="submit"
                  onClick={handleSubmit}
                  variant="contained"
                  color="primary"
                  disabled={submitting || (submitFailed && hasValidationErrors)}
                >
                  Save
                </M.Button>
              </M.DialogActions>
            </>
          )}
        </RF.Form>
      </M.Dialog>
    </>
  )
}
