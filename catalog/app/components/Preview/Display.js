import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import StyledLink from 'utils/StyledLink'

import render from './render'
import { PreviewError } from './types'

const defaultProgress = () => <M.CircularProgress />

const defaultMessage = ({ heading, body, action }) => (
  <>
    {!!heading && (
      <M.Typography variant="h6" gutterBottom>
        {heading}
      </M.Typography>
    )}
    {!!body && (
      <M.Typography variant="body1" gutterBottom>
        {body}
      </M.Typography>
    )}
    {!!action && action}
  </>
)

const defaultAction = ({ label, ...rest }) => (
  <M.Button variant="outlined" {...rest}>
    {label}
  </M.Button>
)

export default function PreviewDisplay({
  data,
  noDownload,
  renderContents = R.identity,
  renderProgress = defaultProgress,
  renderMessage = defaultMessage,
  renderAction = defaultAction,
  onData,
  props,
}) {
  const cfg = Config.use()
  const noDl = noDownload != null ? noDownload : cfg.noDownload

  React.useEffect(() => {
    onData?.(data)
  }, [data, onData])

  return AsyncResult.case(
    {
      _: renderProgress,
      Ok: (...args) => R.pipe(render, renderContents)(...args, props),
      Err: PreviewError.case({
        Deleted: () =>
          renderMessage({
            heading: 'Delete Marker',
            body: (
              <>
                Selected version of the object is a{' '}
                <StyledLink
                  href="https://docs.aws.amazon.com/AmazonS3/latest/dev/DeleteMarker.html"
                  target="_blank"
                >
                  delete marker
                </StyledLink>
              </>
            ),
          }),
        Archived: () =>
          renderMessage({
            heading: 'Object Archived',
            body: 'Preview not available',
          }),
        InvalidVersion: () =>
          renderMessage({
            heading: 'Invalid Version',
            body: 'Invalid version id specified',
          }),
        Forbidden: () =>
          renderMessage({
            heading: 'Access Denied',
            body: 'Preview not available',
          }),
        Gated: ({ load }) =>
          renderMessage({
            heading: 'Object is Too Large',
            body: 'Large files are not previewed by default',
            action: !!load && renderAction({ label: 'Load preview', onClick: load }),
          }),
        TooLarge: ({ handle }) =>
          renderMessage({
            heading: 'Object is Too Large',
            body: 'Object is too large to preview',
            action:
              !noDl &&
              AWS.Signer.withDownloadUrl(handle, (href) =>
                renderAction({ label: 'Download and view in Browser', href }),
              ),
          }),
        Unsupported: ({ handle }) =>
          renderMessage({
            heading: 'Preview Not Available',
            action:
              !noDl &&
              AWS.Signer.withDownloadUrl(handle, (href) =>
                renderAction({ label: 'Download and view in Browser', href }),
              ),
          }),
        DoesNotExist: () =>
          renderMessage({
            heading: 'No Such Object',
            body: 'Object does not exist',
          }),
        SrcDoesNotExist: ({ path }) =>
          renderMessage({
            heading: 'Could Not Resolve Data File',
            body: `Data file referenced as '${path}' could not be resolved`,
          }),
        MalformedJson: ({ message }) =>
          renderMessage({
            heading: 'Malformed JSON',
            body: message,
          }),
        Unexpected: ({ retry }) =>
          renderMessage({
            heading: 'Unexpected Error',
            body: 'Something went wrong while loading preview',
            action: !!retry && renderAction({ label: 'Retry', onClick: retry }),
          }),
        __: ({ retry }) =>
          renderMessage({
            heading: 'Unexpected Error',
            body: 'Something went wrong while loading preview',
            action: !!retry && renderAction({ label: 'Retry', onClick: retry }),
          }),
      }),
    },
    data,
  )
}

export const bind = (props) => (data) => <PreviewDisplay {...props} data={data} />
