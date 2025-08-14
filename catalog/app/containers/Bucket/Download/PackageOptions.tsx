import * as React from 'react'
import * as M from '@material-ui/core'
import { GetApp as IconGetApp, FileCopy as IconFileCopy } from '@material-ui/icons'

import { Tabs } from 'components/Dialog'
import * as urls from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as Selection from '../Selection'

import * as Buttons from './Buttons'
import PackageCodeSamples from './PackageCodeSamples'

interface DownloadDirProps {
  selection?: Selection.ListingSelection
  uri: PackageUri.PackageUri
}

function DownloadDir({ selection, uri }: DownloadDirProps) {
  const isSelectionEmpty = typeof selection === 'undefined'
  const downloadLabel = !isSelectionEmpty // eslint-disable-line no-nested-ternary
    ? 'Download ZIP (selected files)'
    : uri.path
      ? 'Download ZIP (sub-package)'
      : 'Download ZIP (entire package)'
  const downloadPath =
    uri.path && isSelectionEmpty
      ? `package/${uri.bucket}/${uri.name}/${uri.hash}/${uri.path}`
      : `package/${uri.bucket}/${uri.name}/${uri.hash}`
  const fileHandles = React.useMemo(
    () => selection && Selection.toHandlesList(selection),
    [selection],
  )
  return (
    <Buttons.DownloadDir suffix={downloadPath} fileHandles={fileHandles}>
      {downloadLabel}
    </Buttons.DownloadDir>
  )
}

const useQuiltSyncStyles = M.makeStyles((t) => ({
  link: {
    marginBottom: t.spacing(1),
  },
  open: {
    justifyContent: 'flex-start',
  },
  copy: {
    fontSize: t.typography.body1.fontSize,
    width: 'auto',
  },
}))

interface QuiltSyncProps {
  className?: string
  uri: PackageUri.PackageUri
}

function QuiltSync({ className, uri }: QuiltSyncProps) {
  const classes = useQuiltSyncStyles()
  const { push } = Notifications.use()
  const uriString = PackageUri.stringify(uri)

  const handleCopy = React.useCallback(() => {
    copyToClipboard(uriString)
    push('URI has been copied to clipboard')
  }, [uriString, push])

  return (
    <div className={className}>
      <M.ButtonGroup variant="outlined" fullWidth className={classes.link}>
        <M.Button startIcon={<IconGetApp />} href={uriString} className={classes.open}>
          Open in QuiltSync
        </M.Button>
        <M.Button className={classes.copy} onClick={handleCopy}>
          <IconFileCopy fontSize="inherit" />
        </M.Button>
      </M.ButtonGroup>
      <M.Typography variant="caption" component="p">
        Don't have QuiltSync?{' '}
        <StyledLink href={urls.quiltSync} target="_blank">
          Download it here
        </StyledLink>
      </M.Typography>
    </div>
  )
}

const useDownloadPanelStyles = M.makeStyles((t) => ({
  quiltSync: {
    borderBottom: `1px solid ${t.palette.divider}`,
    marginBottom: t.spacing(1),
    paddingBottom: t.spacing(1),
  },
}))

interface DownloadPanelProps {
  fileHandle?: Model.S3.S3ObjectLocation
  selection?: Selection.ListingSelection
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

function DownloadPanel({ fileHandle, selection, uri }: DownloadPanelProps) {
  const classes = useDownloadPanelStyles()
  const { prefs } = BucketPreferences.use()
  return (
    <>
      {BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions } }) =>
            actions.openInDesktop && (
              <QuiltSync className={classes.quiltSync} uri={uri} />
            ),
          _: () => null,
        },
        prefs,
      )}
      {fileHandle ? (
        <Buttons.DownloadFile fileHandle={fileHandle} />
      ) : (
        <DownloadDir selection={selection} uri={uri} />
      )}
    </>
  )
}

interface CodePanelProps {
  hashOrTag: string
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

function CodePanel({ hashOrTag, uri }: CodePanelProps) {
  return <PackageCodeSamples hashOrTag={hashOrTag} {...uri} />
}

interface OptionsProps {
  fileHandle?: Model.S3.S3ObjectLocation
  hashOrTag: string
  hideCode?: boolean
  selection?: Selection.ListingSelection
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

const useOptionsStyles = M.makeStyles((t) => ({
  download: {
    width: t.spacing(40),
  },
  code: {
    width: t.spacing(80),
  },
}))

export default function Options({
  fileHandle,
  hashOrTag,
  hideCode,
  selection,
  uri,
}: OptionsProps) {
  const classes = useOptionsStyles()
  const download = React.useCallback(
    () => ({
      className: classes.download,
      label: 'Download',
      panel: <DownloadPanel fileHandle={fileHandle} selection={selection} uri={uri} />,
    }),
    [classes.download, fileHandle, selection, uri],
  )
  const code = React.useCallback(
    () => ({
      className: classes.code,
      label: 'Code',
      panel: <CodePanel hashOrTag={hashOrTag} uri={uri} />,
    }),
    [classes.code, hashOrTag, uri],
  )
  const tabs = React.useMemo(
    () => (hideCode ? [download()] : [download(), code()]),
    [code, download, hideCode],
  )
  return <Tabs>{tabs}</Tabs>
}
