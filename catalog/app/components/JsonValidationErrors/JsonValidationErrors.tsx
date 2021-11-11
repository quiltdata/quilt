import type { ErrorObject } from 'ajv'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useSingleErrorStyles = M.makeStyles((t) => ({
  code: {
    backgroundColor: t.palette.error.light,
    border: `1px solid ${t.palette.error.dark}`,
    borderRadius: '2px',
    color: t.palette.error.contrastText,
    marginRight: '6px',
    padding: '1px 2px',
  },
}))

type Err = Error | ErrorObject

interface SingleErrorProps {
  className?: string
  error: Err
}

function SingleError({ className, error }: SingleErrorProps) {
  const classes = useSingleErrorStyles()

  return (
    <Lab.Alert severity="error" className={className}>
      {!!(error as ErrorObject).instancePath && (
        <code className={classes.code}>{(error as ErrorObject).instancePath}</code>
      )}
      {error.message}
    </Lab.Alert>
  )
}

const useStyles = M.makeStyles((t) => ({
  item: {
    '& + &': {
      marginTop: t.spacing(1),
    },
  },
}))

interface JsonValidationErrorsProps {
  className: string
  error: Err[] | Err | null
}

export default function JsonValidationErrors({
  className,
  error,
}: JsonValidationErrorsProps) {
  const classes = useStyles()

  if (!error) return null

  return (
    <div className={className}>
      {Array.isArray(error) ? (
        error.map((e) => (
          <SingleError
            className={classes.item}
            error={e}
            key={(e as ErrorObject).instancePath + e.message}
          />
        ))
      ) : (
        <SingleError error={error} />
      )}
    </div>
  )
}
