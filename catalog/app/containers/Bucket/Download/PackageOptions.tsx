// TODO: move to Bucket/Toolbar/Get/

import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as urls from 'constants/urls'
import GetOptions from 'containers/Bucket/Toolbar/GetOptions'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'

import { ZipDownloadForm } from '../FileView'
import * as Selection from '../Selection'

import * as Buttons from './Buttons'
import PackageCodeSamples from './PackageCodeSamples'

const useDownloadButtonStyles = M.makeStyles({
  root: {
    justifyContent: 'flex-start',
    lineHeight: '1.25rem',
    width: '100%',
  },
})

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
  const files = React.useMemo(
    () => fileHandles && fileHandles.map(({ key }) => key),
    [fileHandles],
  )
  const classes = useDownloadButtonStyles()
  const feedback = Buttons.useDownloadFeedback()
  return (
    <ZipDownloadForm suffix={downloadPath} files={files}>
      <M.Button
        className={classes.root}
        startIcon={<Icons.ArchiveOutlined />}
        type="submit"
        {...feedback}
      >
        <span>{downloadLabel}</span>
      </M.Button>
    </ZipDownloadForm>
  )
}

function DownloadFile({ fileHandle }: { fileHandle: Model.S3.S3ObjectLocation }) {
  const url = AWS.Signer.useDownloadUrl(fileHandle)
  const classes = useDownloadButtonStyles()
  return (
    <M.Button
      className={classes.root}
      download
      href={url}
      startIcon={<Icons.ArrowDownwardOutlined />}
    >
      Download file
    </M.Button>
  )
}

const useQuiltSyncStyles = M.makeStyles((t) => ({
  link: {
    marginBottom: t.spacing(1),
  },
  open: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
}))

interface QuiltSyncProps {
  className?: string
  uri: PackageUri.PackageUri
}

function QuiltSync({ className, uri }: QuiltSyncProps) {
  const classes = useQuiltSyncStyles()
  const uriString = PackageUri.stringify(uri)

  return (
    <div className={className}>
      <Buttons.SplitCopyButton copyUri={uriString} className={classes.link}>
        <M.Button startIcon={<Icons.GetApp />} href={uriString} className={classes.open}>
          Open in QuiltSync
        </M.Button>
      </Buttons.SplitCopyButton>
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
        <DownloadFile fileHandle={fileHandle} />
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

export default function Options({
  fileHandle,
  hashOrTag,
  hideCode,
  selection,
  uri,
}: OptionsProps) {
  const download = (
    <DownloadPanel fileHandle={fileHandle} selection={selection} uri={uri} />
  )
  const code = hideCode ? undefined : <CodePanel hashOrTag={hashOrTag} uri={uri} />

  return <GetOptions download={download} code={code} />
}
