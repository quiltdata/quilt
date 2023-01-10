import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import TextField from 'components/Form/TextField'
import log from 'utils/Logging'
import * as validators from 'utils/validators'

const API_ENDPOINT =
  'https://quiltdata.us12.list-manage.com/subscribe/post?u=d1897bee98443ff9c75985a98&id=8730da7955&f_id=0012bfe0f0'

const useSubmitSuccessStyles = M.makeStyles((t) => ({
  root: {
    background: fade('#2b2363', 0.98),
  },
  icon: {
    marginRight: t.spacing(1),
    color: t.palette.success.main,
  },
  message: {
    alignItems: 'center',
    color: t.palette.success.main,
    display: 'flex',
    fontSize: '18px',
    lineHeight: '22px',
  },
}))

interface SubmitSuccessProps {
  className: string
}

function SubmitSuccess({ className }: SubmitSuccessProps) {
  const classes = useSubmitSuccessStyles()
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.message}>
        <M.Icon className={classes.icon}>check_circle_outline</M.Icon>
        <M.Typography className={classes.message}>
          Thank you for your submission
        </M.Typography>
      </div>
    </div>
  )
}

const useSubmitErrorStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    marginRight: t.spacing(1),
    color: t.palette.error.main,
  },
  message: {
    color: t.palette.error.main,
    fontSize: '16px',
    lineHeight: '32px',
  },
}))

interface SubmitErrorProps {
  className: string
  error: string
}

function SubmitError({ className, error }: SubmitErrorProps) {
  const classes = useSubmitErrorStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Icon className={classes.icon}>error_outline</M.Icon>
      <M.Typography className={classes.message}>{error}</M.Typography>
    </div>
  )
}

const useSubmitSpinnerStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0.7),
  },
}))

interface SubmitSpinnerProps {
  className: string
}

function SubmitSpinner({ className }: SubmitSpinnerProps) {
  const classes = useSubmitSpinnerStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.CircularProgress size={48} variant="indeterminate" />
    </div>
  )
}

const useSubmitStatusStyles = M.makeStyles((t) => ({
  overlay: {
    alignItems: 'center',
    borderRadius: t.spacing(2),
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  error: {
    marginTop: '14px',
  },
}))

interface SubmitStatusProps {
  submitting: boolean
  error: string
  success: boolean
}

function SubmitStatus({ submitting, error, success }: SubmitStatusProps) {
  const classes = useSubmitStatusStyles()
  if (submitting) return <SubmitSpinner className={classes.overlay} />
  if (success) return <SubmitSuccess className={classes.overlay} />
  if (error) return <SubmitError error={error} className={classes.error} />
  return null
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: '#2b2363',
    borderRadius: t.spacing(2),
    maxWidth: '490px',
    padding: '52px 28px',
    position: 'relative',
  },
  description: {
    color: t.palette.text.primary,
    fontSize: '18px',
    lineHeight: '22px',
    marginBottom: '28px',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '28px',
  },
  note: {
    color: t.palette.text.primary,
    fontSize: '16px',
    lineHeight: '32px',
    marginTop: '28px',
    textAlign: 'center',
  },
  group: {
    display: 'flex',
    marginBottom: '10px',
  },
  input: {
    alignItems: 'flex-start',
    flexGrow: 1,
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  inputRoot: {
    background: t.palette.common.white,
    border: '2px solid #9ba7b6',
    borderRadius: '7px',
    color: t.palette.getContrastText(t.palette.common.white),
    fontSize: '16px',
    lineHeight: '32px',
    padding: '0 12px',
    width: '100%',
  },
}))

interface FormProps {
  className?: string
}

export default function Form({ className }: FormProps) {
  const classes = useStyles()
  const inputClasses = React.useMemo(
    () => ({
      root: classes.inputRoot,
    }),
    [classes],
  )

  const onSubmit = React.useCallback(
    ({ firstName, lastName, companyName, companyEmail }) => {
      try {
        const data = new URLSearchParams({
          FNAME: firstName,
          LNAME: lastName,
          CNAME: companyName,
          EMAIL: companyEmail,
        })
        window.fetch(API_ENDPOINT, {
          method: 'POST',
          body: data,
          mode: 'no-cors',
        })
      } catch (error) {
        log.error(error)
        return { [FF.FORM_ERROR]: "Couldn't submit form" }
      }
    },
    [],
  )
  return (
    <RF.Form onSubmit={onSubmit}>
      {({
        handleSubmit,
        submitSucceeded,
        submitting,
        submitFailed,
        submitError,
        error,
        hasValidationErrors,
      }) => (
        <form className={cx(classes.root, className)} onSubmit={handleSubmit}>
          <M.Typography className={classes.description}>
            Quilt is available in the AWS Marketplace. We bring seamless collaboration to
            S3 by connecting people, pipelines, and machines using visual, verifiable,
            versioned data packages.
          </M.Typography>
          <div className={classes.group}>
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="firstName"
              placeholder="First Name*"
              disabled={submitting}
              validate={validators.required as FF.FieldValidator<any>}
              errors={{
                required: 'First name is required',
              }}
            />
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="lastName"
              placeholder="Last Name*"
              disabled={submitting}
              validate={validators.required as FF.FieldValidator<any>}
              errors={{
                required: 'Last name is required',
              }}
            />
          </div>
          <div className={classes.group}>
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="companyName"
              placeholder="Company Name*"
              disabled={submitting}
              validate={validators.required as FF.FieldValidator<any>}
              errors={{
                required: 'Company name is required',
              }}
            />
          </div>
          <div className={classes.group}>
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="companyEmail"
              placeholder="Company Email*"
              disabled={submitting}
              validate={validators.required as FF.FieldValidator<any>}
              errors={{
                required: 'Company email is required',
              }}
            />
          </div>
          <SubmitStatus
            submitting={submitting}
            error={error || submitError}
            success={submitSucceeded}
          />
          <M.Typography className={classes.note}>
            By submitting this form, I agree to receive email updates about Quilt
          </M.Typography>
          <div className={classes.actions}>
            <M.Button
              type="submit"
              color="secondary"
              variant="contained"
              disabled={submitting || (submitFailed && hasValidationErrors)}
            >
              Submit
            </M.Button>
          </div>
        </form>
      )}
    </RF.Form>
  )
}
