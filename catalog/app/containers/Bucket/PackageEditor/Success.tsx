import * as M from '@material-ui/core'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'

import DialogSuccess from '../PackageDialog/DialogSuccess'

import * as State from './State'
import type { Success } from './State/Main'

interface SuccessProps {
  bucket: string
  success: Success
}
function SuccessDialog({ bucket, success }: SuccessProps) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const handleClose = React.useCallback(() => {
    history.push(urls.bucketPackageEditor(bucket, success.name, success.hash))
  }, [bucket, success, history, urls])

  return (
    <M.Dialog fullWidth maxWidth="sm" open={!!success}>
      <DialogSuccess
        bucket={bucket}
        name={success?.name || ''}
        onClose={handleClose}
        hash={success?.hash}
      />
    </M.Dialog>
  )
}

export default function SuccessContainer() {
  const {
    fields: { bucket },
    main,
  } = State.use()

  if (!bucket.state.value || !bucket.state.value.name) return null

  const success = main.getters.success()
  if (!success) return null

  return <SuccessDialog bucket={bucket.state.value.name} success={success} />
}
