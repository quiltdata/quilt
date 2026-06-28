import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import StyledLink from 'utils/StyledLink'

import ArchivedMessage from './ArchivedMessage'
import render from './render'
import { PreviewError } from './types'

interface MessageData {
  heading?: React.ReactNode
  body?: React.ReactNode
  action?: React.ReactNode
}

interface ActionData {
  label: React.ReactNode
  [key: string]: unknown
}

interface PreviewDisplayProps {
  // The loaded result — an AsyncResult instance fed to AsyncResult.case.
  data: $TSFixMe
  noDownload?: boolean
  renderContents?: (...args: any[]) => React.ReactNode
  // called via AsyncResult.case, which passes the matched instance, so it may
  // receive args (also lets a plain component be used as the progress renderer)
  renderProgress?: (...args: any[]) => React.ReactNode
  renderMessage?: (msg: any) => React.ReactNode
  renderAction?: (action: any) => React.ReactNode
  onData?: (data: $TSFixMe) => void
  // Forwarded to the render functions.
  props?: $TSFixMe
}

const defaultProgress = () => <M.CircularProgress />

const defaultMessage = ({ heading, body, action }: MessageData) => (
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

const defaultAction = ({ label, ...rest }: ActionData) => (
  <M.Button variant="outlined" {...rest}>
    {label}
  </M.Button>
)

export default function PreviewDisplay({
  data,
  noDownload = undefined,
  renderContents = R.identity,
  renderProgress = defaultProgress,
  renderMessage = defaultMessage,
  renderAction = defaultAction,
  onData = undefined,
  props = undefined,
}: PreviewDisplayProps) {
  const noDl = noDownload != null ? noDownload : cfg.noDownload

  React.useEffect(() => {
    onData?.(data)
  }, [data, onData])

  return AsyncResult.case(
    {
      _: renderProgress,
      Ok: (...args: any[]) =>
        (R.pipe(render, renderContents) as (...a: any[]) => React.ReactNode)(
          ...args,
          props,
        ),
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
        Archived: ({ handle, archive }: $TSFixMe) => (
          <ArchivedMessage handle={handle} archive={archive}>
            {({ heading, body, action }) =>
              renderMessage({
                heading,
                body,
                action: !noDl && action && renderAction(action),
              })
            }
          </ArchivedMessage>
        ),
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
        Gated: ({ load }: $TSFixMe) =>
          renderMessage({
            heading: 'Object is Too Large',
            body: 'Large files are not previewed by default',
            action: !!load && renderAction({ label: 'Load preview', onClick: load }),
          }),
        TooLarge: ({ handle }: $TSFixMe) =>
          renderMessage({
            heading: 'Object is Too Large',
            body: 'Object is too large to preview',
            action:
              !noDl &&
              AWS.Signer.withDownloadUrl(handle, (href: string) =>
                renderAction({ label: 'Download and view in Browser', href }),
              ),
          }),
        Unsupported: ({ handle }: $TSFixMe) =>
          renderMessage({
            heading: 'Preview Not Supported',
            body: 'Previewing this data type is not supported',
            action:
              !noDl &&
              AWS.Signer.withDownloadUrl(handle, (href: string) =>
                renderAction({ label: 'Download and view in Browser', href }),
              ),
          }),
        DoesNotExist: () =>
          renderMessage({
            heading: 'No Such Object',
            body: 'Object does not exist',
          }),
        SrcDoesNotExist: ({ path }: $TSFixMe) =>
          renderMessage({
            heading: 'Could Not Resolve Data File',
            body: `Data file referenced as '${path}' could not be resolved`,
          }),
        MalformedJson: ({ message }: $TSFixMe) =>
          renderMessage({
            heading: 'Malformed JSON',
            body: message,
          }),
        Expired: ({ retry }: $TSFixMe) =>
          renderMessage({
            heading: 'Session expired',
            body: !retry && 'Try to reload the page',
            action: !!retry && renderAction({ label: 'Retry', onClick: retry }),
          }),
        Unexpected: ({ retry, message }: $TSFixMe) =>
          renderMessage({
            heading: 'Unexpected Error',
            body: message || 'Something went wrong while loading preview',
            action: !!retry && renderAction({ label: 'Retry', onClick: retry }),
          }),
        __: ({ retry }: $TSFixMe) =>
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

export const bind = (props: Omit<PreviewDisplayProps, 'data'>) => (data: $TSFixMe) => (
  <PreviewDisplay {...props} data={data} />
)
