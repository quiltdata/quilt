import PT from 'prop-types'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { mapProps, setPropTypes } from 'recompose'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
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

export const Heading = styled('h1')(
  {
    textAlign: 'center',
  },
  { name: 'Auth.Heading' },
)

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
  TextField,
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
      marginTop: t.spacing.unit * 3,
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
    marginTop: t.spacing.unit * 4,
  }),
  { name: 'Auth.Actions' },
)

export const Hint = styled('p')(
  ({ theme: t }) => ({
    fontSize: 12,
    lineHeight: '16px',
    marginBottom: t.spacing.unit * 1.5,
    marginTop: t.spacing.unit * 4,
    textAlign: 'center',

    // TODO: this selector is quite fragile, we should fix this
    'p + &': {
      marginTop: t.spacing.unit * 1.5,
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

export const mkLayout = (heading) => ({ children }) => (
  <Layout>
    <Container>
      <Heading>{heading}</Heading>
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
    <Button color="primary" variant="contained" type="submit" {...rest}>
      {label}
      {children}
      {busy && (
        <React.Fragment>
          &nbsp;
          <Spinner
            style={{
              fontSize: '1.5em',
              opacity: '.5',
              position: 'absolute',
              right: '-1.5em',
            }}
          />
        </React.Fragment>
      )}
    </Button>
  ),
)
