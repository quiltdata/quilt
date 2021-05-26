import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'

type ARN = string

const useStyles = M.makeStyles((t) => ({
  caption: {
    color: t.palette.text.secondary,
  },
  captionWrapper: {
    margin: t.spacing(0.5, 0, 0),
  },
}))

interface ArnInputProps {
  className: string
  input: {
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    value: ARN
  }
  onBasic: () => void

  meta: $TSFixMe
  error?: string
  errors: Record<string, string>
  helperText?: React.ReactNode
}

export default function ArnInput({
  className,
  input,
  onBasic,

  meta,
  errors,
  helperText,
  ...rest
}: ArnInputProps & M.TextFieldProps) {
  const classes = useStyles()

  const error = meta.submitFailed && meta.error
  const props = {
    error: !!error,
    helperText: error ? errors[error] || error : helperText,
    disabled: meta.submitting || meta.submitSucceeded,
    ...input,
    ...rest,
  }

  return (
    <div className={className}>
      <M.Typography variant="h6">ARN</M.Typography>
      <p className={classes.captionWrapper}>
        <M.Typography className={classes.caption} variant="caption">
          Manage access using per-bucket permissions or{' '}
          <StyledLink onClick={onBasic}>set existing role via ARN</StyledLink>
        </M.Typography>
      </p>

      <M.TextField {...props} />
    </div>
  )
}
