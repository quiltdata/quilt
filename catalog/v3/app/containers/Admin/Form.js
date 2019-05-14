import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import * as RF from 'redux-form/immutable'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

export const Field = RT.composeComponent(
  'Admin.Form.Field',
  RC.setPropTypes({
    input: PT.object.isRequired,
    meta: PT.object.isRequired,
    errors: PT.objectOf(PT.node),
    label: PT.node,
  }),
  ({ input, meta, errors, label, ...rest }) => {
    const error = meta.submitFailed && meta.error
    const props = {
      error: !!error,
      label: error ? errors[error] || error : label,
      disabled: meta.submitting || meta.submitSucceeded,
      ...input,
      ...rest,
    }
    return <TextField {...props} />
  },
)

export const FormError = RT.composeComponent(
  'Admin.Form.FormError',
  withStyles((t) => ({
    root: {
      marginTop: t.spacing.unit * 3,

      '& a': {
        textDecoration: 'underline',
      },
    },
  })),
  ({ error, errors, ...rest }) =>
    !!error && (
      <Typography color="error" {...rest}>
        {errors[error] || error}
      </Typography>
    ),
)

export const ReduxForm = RF.reduxForm()(({ children, ...props }) => children(props))
