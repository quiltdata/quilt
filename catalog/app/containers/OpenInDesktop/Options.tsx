import * as React from 'react'
import * as M from '@material-ui/core'
import invariant from 'invariant'

import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as FileView from '../Bucket/FileView'
import PackageCodeSamples from '../Bucket/CodeSamples/Package'
import * as Selection from '../Bucket/Selection'

interface DownloadFileProps {
  className?: string
  fileHandle: Model.S3.S3ObjectLocation
}

function DownloadFile({ className, fileHandle }: DownloadFileProps) {
  const url = AWS.Signer.useDownloadUrl(fileHandle)
  return (
    <div className={className}>
      <M.Button
        startIcon={<M.Icon>arrow_downward</M.Icon>}
        className={className}
        href={url}
        download
      >
        Download file
      </M.Button>
    </div>
  )
}

interface DownloadDirProps {
  className?: string
  uri: PackageUri.PackageUri
}

function DownloadDir({ className, uri }: DownloadDirProps) {
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
      className={className}
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
    marginBottom: t.spacing(1),
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
      <M.Typography variant="body2">
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
  root: {
    overflow: 'hidden',
  },
  tabsContainer: {
    borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0`,
    display: 'flex',
    height: t.spacing(5),
  },
  tabButton: {
    flex: 1,
    color: t.palette.text.secondary,
    borderRadius: 0,
    textTransform: 'none',
    position: 'relative',
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  activeTab: {
    color: t.palette.text.primary,
    '&:after': {
      animation: `$activate 150ms ease-out`,
      content: '""',
      position: 'absolute',
      bottom: '-2px',
      left: 0,
      right: 0,
      height: '2px',
      backgroundColor: t.palette.primary.main,
    },
  },
  download: {
    margin: t.spacing(1, 0),
  },
  quiltSync: {
    padding: t.spacing(2, 0),
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  tab: {
    padding: t.spacing(0, 2),
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
  '@keyframes activate': {
    '0%': {
      transform: 'scaleX(0.5)',
    },
    '100%': {
      opacity: 'scaleX(1)',
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
      <M.Paper className={classes.tabsContainer} elevation={1}>
        <M.Button
          className={`${classes.tabButton} ${tab === 0 ? classes.activeTab : ''}`}
          onClick={() => setTab(0)}
        >
          QuiltSync
        </M.Button>
        <M.Divider orientation="vertical" />
        <M.Button
          className={`${classes.tabButton} ${tab === 1 ? classes.activeTab : ''}`}
          onClick={() => setTab(1)}
        >
          Quilt3
        </M.Button>
      </M.Paper>
      {tab === 0 && (
        <div className={classes.tab}>
          <QuiltSync className={classes.quiltSync} uri={uri} />
          {fileHandle ? (
            <DownloadFile className={classes.download} fileHandle={fileHandle} />
          ) : (
            <DownloadDir className={classes.download} uri={uri} />
          )}
        </div>
      )}
      {tab === 1 && (
        <PackageCodeSamples className={classes.tab} hashOrTag={hashOrTag} {...uri} />
      )}
    </div>
  )
}
