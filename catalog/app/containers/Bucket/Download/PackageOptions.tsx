import * as React from 'react'
import * as M from '@material-ui/core'
import invariant from 'invariant'

import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as FileView from '../FileView'
import PackageCodeSamples from '../CodeSamples/Package'
import * as Selection from '../Selection'
import { Tabs, TabPanel } from './OptionsTabs'

const useDownloadPanelStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(60),
  },
}))

const useCodePanelStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(80),
  },
}))

interface DownloadFileProps {
  fileHandle: Model.S3.S3ObjectLocation
}

function DownloadFile({ fileHandle }: DownloadFileProps) {
  const url = AWS.Signer.useDownloadUrl(fileHandle)
  return (
    <M.Button startIcon={<M.Icon>arrow_downward</M.Icon>} href={url} download>
      Download file
    </M.Button>
  )
}

interface DownloadDirProps {
  uri: PackageUri.PackageUri
}

function DownloadDir({ uri }: DownloadDirProps) {
  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within a Selection.Provider')

  const downloadLabel = !slt.isEmpty // eslint-disable-line no-nested-ternary
    ? 'Download ZIP (selected files only)'
    : uri.path
      ? 'Download ZIP (sub-package)'
      : 'Download ZIP (entire package)'
  const downloadPath =
    uri.path && slt.isEmpty
      ? `package/${uri.bucket}/${uri.name}/${uri.hash}/${uri.path}`
      : `package/${uri.bucket}/${uri.name}/${uri.hash}`
  return (
    <FileView.ZipDownloadForm
      suffix={downloadPath}
      files={Selection.toHandlesList(slt.selection).map(({ key }) => key)}
    >
      <M.Button startIcon={<M.Icon>archive</M.Icon>} type="submit">
        {downloadLabel}
      </M.Button>
    </FileView.ZipDownloadForm>
  )
}

const useQuiltSyncStyles = M.makeStyles((t) => ({
  link: {
    alignItems: 'center',
    display: 'flex',
  },
  copy: {
    flexShrink: 0,
    marginLeft: t.spacing(1),
  },
  uriLink: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
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
    push('Code has been copied to clipboard')
  }, [uriString, push])

  return (
    <div className={className}>
      <div className={classes.link}>
        <StyledLink className={classes.uriLink} href={uriString} title={uriString}>
          {uriString}
        </StyledLink>
        <M.IconButton className={classes.copy} onClick={handleCopy} size="small">
          <M.Icon fontSize="inherit">file_copy</M.Icon>
        </M.IconButton>
      </div>
      <M.Typography variant="caption">
        Don't have QuiltSync?{' '}
        <StyledLink href="" target="_blank">
          Download it here
        </StyledLink>
        .
      </M.Typography>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  quiltSync: {
    padding: t.spacing(0, 0, 2),
    borderBottom: `1px solid ${t.palette.divider}`,
    marginBottom: t.spacing(1),
  },
}))

interface DownloadPanelProps {
  fileHandle?: Model.S3.S3ObjectLocation
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

function DownloadPanel({ fileHandle, uri }: DownloadPanelProps) {
  const classes = useStyles()
  const panelClasses = useDownloadPanelStyles()

  return (
    <TabPanel className={panelClasses.root}>
      <QuiltSync className={classes.quiltSync} uri={uri} />
      {fileHandle ? <DownloadFile fileHandle={fileHandle} /> : <DownloadDir uri={uri} />}
    </TabPanel>
  )
}

interface CodePanelProps {
  hashOrTag: string
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

function CodePanel({ hashOrTag, uri }: CodePanelProps) {
  const classes = useCodePanelStyles()
  return (
    <TabPanel className={classes.root}>
      <PackageCodeSamples hashOrTag={hashOrTag} {...uri} />
    </TabPanel>
  )
}

type DisplayOptions =
  | { hideDownload: true; hideCode?: never }
  | { hideDownload?: never; hideCode: true }
  | { hideDownload?: never; hideCode?: never }

type OptionsProps = DisplayOptions & {
  hashOrTag: string
  fileHandle?: Model.S3.S3ObjectLocation
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

export default function Options({
  fileHandle,
  hashOrTag,
  uri,
  hideDownload,
  hideCode,
}: OptionsProps) {
  if (hideDownload) return <CodePanel hashOrTag={hashOrTag} uri={uri} />

  if (hideCode) return <DownloadPanel fileHandle={fileHandle} uri={uri} />

  return (
    <Tabs labels={['QuiltSync', 'Code']}>
      {(activeTab) =>
        !activeTab ? (
          <DownloadPanel fileHandle={fileHandle} uri={uri} />
        ) : (
          <CodePanel hashOrTag={hashOrTag} uri={uri} />
        )
      }
    </Tabs>
  )
}
