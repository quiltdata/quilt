import * as React from 'react'

import * as Lab from '@material-ui/lab'

export default function Errors({ className, errors }) {
  return (
    <div className={className}>
      {errors.map((error) => (
        <Lab.Alert severity="error" key={error.dataPath}>
          <code>`{error.dataPath}`</code>: {error.message}
        </Lab.Alert>
      ))}
    </div>
  )
}
