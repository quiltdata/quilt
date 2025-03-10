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
import * as Selection from '../Selection'

import { Tabs, TabPanel } from './OptionsTabs'
import PackageCodeSamples from './PackageCodeSamples'

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
    marginBottom: t.spacing(0.5),
  },
  copy: {
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
        <M.Button startIcon={<M.Icon>download</M.Icon>} href={uriString}>
          Open in QuiltSync
        </M.Button>
        <M.Button className={classes.copy} onClick={handleCopy}>
          <M.Icon fontSize="inherit">file_copy_outlined</M.Icon>
        </M.Button>
      </M.ButtonGroup>
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

const useDownloadPanelStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(40),
    maxWidth: t.spacing(60),
  },
  quiltSync: {
    borderBottom: `1px solid ${t.palette.divider}`,
    marginBottom: t.spacing(1),
    paddingBottom: t.spacing(1),
  },
}))

interface DownloadPanelProps {
  fileHandle?: Model.S3.S3ObjectLocation
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

function DownloadPanel({ fileHandle, uri }: DownloadPanelProps) {
  const classes = useDownloadPanelStyles()

  return (
    <TabPanel className={classes.root}>
      <QuiltSync className={classes.quiltSync} uri={uri} />
      {fileHandle ? <DownloadFile fileHandle={fileHandle} /> : <DownloadDir uri={uri} />}
    </TabPanel>
  )
}

const useCodePanelStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(80),
  },
}))

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

interface OptionsProps {
  hashOrTag: string
  fileHandle?: Model.S3.S3ObjectLocation
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
  hideCode?: boolean
}

export default function Options({ fileHandle, hashOrTag, uri, hideCode }: OptionsProps) {
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
