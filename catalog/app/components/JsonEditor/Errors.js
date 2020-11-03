import * as React from 'react'

import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  code: {
    backgroundColor: t.palette.error.light,
    border: `1px solid ${t.palette.error.dark}`,
    borderRadius: '2px',
    color: t.palette.error.contrastText,
    marginRight: '6px',
    padding: '1px 2px',
  },
}))

export default function Errors({ className, errors }) {
  const classes = useStyles()

  return (
    <div className={className}>
      {errors.map((error) => (
        <Lab.Alert severity="error" key={error.dataPath + error.message}>
          {error.dataPath && (
            <>
              <code className={classes.code}>{error.dataPath}</code>
            </>
          )}
          {error.message}
        </Lab.Alert>
      ))}
    </div>
  )
}
