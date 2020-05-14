import PT from 'prop-types'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { mapProps, setPropTypes } from 'recompose'
import * as M from '@material-ui/core'
import { styled, withStyles } from '@material-ui/styles'
import Layout from 'components/Layout'
import Spinner from 'components/Spinner'
import { composeComponent } from 'utils/reactTools'

export const Container = styled('div')(
  {
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: 280,
    minHeight: 'calc(100vh - 300px)',
    width: '100%',
  },
  { name: 'Auth.Container' },
)

export const Heading = (props) => <M.Typography variant="h4" align="center" {...props} />

export const Field = composeComponent(
  'Auth.Field',
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.object.isRequired,
    errors: PT.objectOf(PT.node),
  }),
  mapProps(({ input, meta, errors, floatingLabelText: label, ...rest }) => ({
    error: meta.submitFailed && !!meta.error,
    helperText:
      meta.submitFailed && meta.error
        ? errors[meta.error] || /* istanbul ignore next */ meta.error
        : undefined,
    label,
    fullWidth: true,
    margin: 'normal',
    ...input,
    ...rest,
  })),
  M.TextField,
)

export const FieldErrorLink = styled(Link)(
  {
    color: 'inherit !important',
    textDecoration: 'underline',
  },
  { name: 'Auth.FieldErrorLink' },
)

export const Error = composeComponent(
  'Auth.Error',
  withStyles((t) => ({
    root: {
      color: t.palette.error.main,
      marginTop: t.spacing(3),
      textAlign: 'center',

      '& a': {
        color: 'inherit !important',
        textDecoration: 'underline',
      },
    },
  })),
  mapProps(({ submitFailed, error, errors, classes, ...rest }) => ({
    error:
      submitFailed && error
        ? errors[error] /* istanbul ignore next */ || error
        : undefined,
    className: classes.root,
    ...rest,
  })),
  ({ error, ...rest }) => (error ? <p {...rest}>{error}</p> : null),
)

export const Actions = styled('div')(
  ({ theme: t }) => ({
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(4),
  }),
  { name: 'Auth.Actions' },
)

export const Hint = styled('p')(
  ({ theme: t }) => ({
    fontSize: 12,
    lineHeight: '16px',
    marginBottom: t.spacing(1.5),
    marginTop: t.spacing(4),
    textAlign: 'center',

    // TODO: this selector is quite fragile, we should fix this
    'p + &': {
      marginTop: t.spacing(1.5),
    },
  }),
  { name: 'Auth.Hint' },
)

export const Message = styled('p')(
  {
    textAlign: 'center',
  },
  { name: 'Auth.Message' },
)

export const mkLayout = (heading) => ({ children, ...props }) => (
  <Layout>
    <Container>
      <Heading>{typeof heading === 'function' ? heading(props) : heading}</Heading>
      {children}
    </Container>
  </Layout>
)

export const Submit = composeComponent(
  'Auth.Submit',
  setPropTypes({
    busy: PT.bool,
    // TODO: deprecate
    label: PT.node,
    children: PT.node,
  }),
  ({ busy, label, children, ...rest }) => (
    <M.Button color="primary" variant="contained" type="submit" {...rest}>
      {label}
      {children}
      {busy && (
        <>
          &nbsp;
          <Spinner
            style={{
              fontSize: '1.5em',
              opacity: '.5',
              position: 'absolute',
              right: '-1.5em',
            }}
          />
        </>
      )}
    </M.Button>
  ),
)

export const Or = composeComponent(
  'Auth.Or',
  withStyles((t) => ({
    root: {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: t.spacing(4),
    },
    divider: {
      flexGrow: 1,
    },
    text: {
      paddingLeft: t.spacing(1),
      paddingRight: t.spacing(1),
    },
  })),
  ({ classes }) => (
    <div className={classes.root}>
      <M.Divider className={classes.divider} />
      <M.Typography variant="button" className={classes.text}>
        Or
      </M.Typography>
      <M.Divider className={classes.divider} />
    </div>
  ),
)
