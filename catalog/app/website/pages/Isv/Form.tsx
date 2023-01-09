import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import TextField from 'components/Form/TextField'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: '#2b2363',
    borderRadius: t.spacing(2),
    maxWidth: '490px',
    padding: '52px 28px',
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
      const data = new URLSearchParams()
      data.append('FNAME', firstName)
      data.append('LNAME', lastName)
      data.append('CNAME', companyName)
      data.append('EMAIL', companyEmail)
      const url =
        'https://quiltdata.us12.list-manage.com/subscribe/post?u=d1897bee98443ff9c75985a98&id=8730da7955&f_id=0012bfe0f0'
      window.fetch(url, {
        method: 'POST',
        body: data,
        mode: 'no-cors',
      })
    },
    [],
  )
  return (
    <RF.Form onSubmit={onSubmit}>
      {({
        handleSubmit,
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
            />
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="lastName"
              placeholder="Last Name*"
            />
          </div>
          <div className={classes.group}>
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="companyName"
              placeholder="Company Name*"
            />
          </div>
          <div className={classes.group}>
            <RF.Field
              InputProps={{ classes: inputClasses }}
              className={classes.input}
              component={TextField}
              name="companyEmail"
              placeholder="Company Email*"
            />
          </div>
          <M.Typography className={classes.note}>
            By submitting this form, I agree to receive email updates about Quilt
          </M.Typography>
          <div className={classes.actions}>
            <M.Button type="submit" color="secondary" variant="contained">
              Submit
            </M.Button>
          </div>
        </form>
      )}
    </RF.Form>
  )
}
