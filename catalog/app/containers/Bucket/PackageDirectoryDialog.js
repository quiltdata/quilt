import * as React from 'react'
// import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as PD from './PackageDialog'
import * as requests from './requests'

function DialogForm() {
  return <h1>It works</h1>
}

function DialogError({ bucket, error, onCancel }) {
  const { urls } = NamedRoutes.use()

  // FIXME: edit text
  return (
    <PD.DialogError
      error={error}
      skeletonElement={<PD.FormSkeleton animate={false} />}
      title={
        <>
          Push package to{' '}
          <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
            {bucket}
          </StyledLink>{' '}
          bucket
        </>
      }
      onCancel={onCancel}
    />
  )
}

function DialogLoading({ bucket, onCancel }) {
  const { urls } = NamedRoutes.use()

  // FIXME: edit text
  return (
    <PD.DialogLoading
      skeletonElement={<PD.FormSkeleton />}
      title={
        <>
          Push package to{' '}
          <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
            {bucket}
          </StyledLink>{' '}
          bucket
        </>
      }
      onCancel={onCancel}
    />
  )
}

export default function PackageDirectoryDialog({
  onClose,
  onExited,
  open,
  path,
  successor,
}) {
  const s3 = AWS.S3.use()

  const [success, setSuccess] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const workflowsData = Data.use(
    requests.workflowsList,
    { s3, bucket: successor ? successor.slug : '' },
    { noAutoFetch: !successor || !open },
  )

  const handleClose = React.useCallback(() => {
    if (submitting) return

    onExited({
      pushed: success,
    })
    if (onClose) onClose()
    setSuccess(null)
  }, [submitting, success, setSuccess, onClose, onExited])

  return (
    <M.Dialog fullWidth open={open} scroll="body">
      {workflowsData.case({
        Err: (e) =>
          successor && (
            <DialogError bucket={successor.slug} onCancel={handleClose} error={e} />
          ),
        Ok: (props) =>
          successor && (
            <DialogForm
              {...{
                onSubmitStart: () => setSubmitting(true),
                onSubmitEnd: () => setSubmitting(false),
                path,
                ...props,
              }}
            />
          ),
        _: () =>
          successor && <DialogLoading bucket={successor.slug} onCancel={handleClose} />,
      })}
    </M.Dialog>
  )
}
