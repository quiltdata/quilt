import * as M from '@material-ui/core'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import { L } from 'components/Form/Package/types'
import * as NamedRoutes from 'utils/NamedRoutes'

import DialogSuccess from '../PackageDialog/DialogSuccess'

import * as State from './State'

export default function Success() {
  const { main, name, bucket } = State.use()
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const handleClose = React.useCallback(() => {
    if (
      !main.state.success ||
      !bucket.state.value ||
      !bucket.state.value.name ||
      name.state === L
    ) {
      return null
    }
    history.push(
      urls.bucketPackageEditor(
        bucket.state.value.name,
        main.state.success.name,
        main.state.success.hash,
      ),
    )
  }, [bucket.state.value, main.state, name.state, history, urls])

  if (!bucket.state.value || !bucket.state.value.name || name.state === L) {
    return null
  }

  return (
    <M.Dialog fullWidth maxWidth="sm" open={!!main.state.success}>
      <DialogSuccess
        bucket={bucket.state.value.name}
        name={name.state.value}
        onClose={handleClose}
        hash={main.state.success?.hash}
      />
    </M.Dialog>
  )
}
