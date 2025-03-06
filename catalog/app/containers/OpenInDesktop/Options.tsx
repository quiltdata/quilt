import * as React from 'react'
import * as M from '@material-ui/core'
import invariant from 'invariant'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'

import * as FileView from '../Bucket/FileView'
import PackageCodeSamples from '../Bucket/CodeSamples/Package'
import * as Selection from '../Bucket/Selection'

interface DownloadProps {
  className?: string
  fileHandle?: Model.S3.S3ObjectLocation
  uri: PackageUri.PackageUri
}

function Download({ className, fileHandle, uri }: DownloadProps) {
  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within a Selection.Provider')
  if (fileHandle) {
    return AWS.Signer.withDownloadUrl(fileHandle, (url: string) => (
      <M.Button
        startIcon={<M.Icon>arrow_downward</M.Icon>}
        className={className}
        href={url}
        download
      >
        Download file
      </M.Button>
    ))
  }

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
    display: 'flex',
    alignItems: 'center',
  },
  copy: {
    flexShrink: 0,
    marginLeft: t.spacing(1),
  },
  app: {
    margin: t.spacing(1, 0),
  },
  divider: {
    margin: t.spacing(2, 0),
  },
}))

interface QuiltSyncProps {
  className?: string
  fileHandle?: Model.S3.S3ObjectLocation
  uri: PackageUri.PackageUri
}

function QuiltSync({ className, fileHandle, uri }: QuiltSyncProps) {
  const classes = useQuiltSyncStyles()

  return (
    <div className={className}>
      <div className={classes.link}>
        <M.TextField
          size="small"
          onFocus={(e) => e.target.select()}
          fullWidth
          inputProps={{ readOnly: true }}
          value={PackageUri.stringify(uri)}
          variant="outlined"
        />
        <M.IconButton className={classes.copy} onClick={() => {}}>
          <M.Icon fontSize="inherit">file_copy</M.Icon>
        </M.IconButton>
      </div>
      <M.Typography variant="body2" className={classes.app}>
        Don't have QuiltSync?{' '}
        <StyledLink href="" target="_blank">
          Download it here
        </StyledLink>
        .
      </M.Typography>

      <M.Divider className={classes.divider} />

      <Download className={className} fileHandle={fileHandle} uri={uri} />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {},
  container: {
    padding: t.spacing(2),
  },
  tabs: {
    borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0`,
  },
  tab: {
    animation: `$show 150ms ease-out`,
  },
  '@keyframes show': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: '1',
    },
  },
}))

interface OptionsProps {
  hashOrTag: string
  fileHandle?: Model.S3.S3ObjectLocation
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

export default function Options({ fileHandle, hashOrTag, uri }: OptionsProps) {
  const classes = useStyles()
  const [tab, setTab] = React.useState(0)
  return (
    <div className={classes.root}>
      <M.Paper className={classes.tabs} elevation={1}>
        <M.Tabs variant="fullWidth" value={tab}>
          <M.Tab label="QuiltSync" onClick={() => setTab(0)} />
          <M.Tab label="Quilt3" onClick={() => setTab(1)} />
        </M.Tabs>
      </M.Paper>
      <div className={classes.container}>
        {tab === 0 && (
          <QuiltSync className={classes.tab} uri={uri} fileHandle={fileHandle} />
        )}
        {tab === 1 && (
          <PackageCodeSamples className={classes.tab} hashOrTag={hashOrTag} {...uri} />
        )}
      </div>
    </div>
  )
}
