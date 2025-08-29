import * as React from 'react'
import * as M from '@material-ui/core'

import * as urls from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as PackageUri from 'utils/PackageUri'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as FileView from '../FileView'
import * as Selection from '../Selection'

import PackageCodeSamples from './PackageCodeSamples'

// Local tabs implementation since OptionsTabs was removed
const Tabs = ({
  download,
  code,
}: {
  download: React.ReactNode
  code: React.ReactNode
}) => {
  const [value, setValue] = React.useState(0)
  return (
    <>
      <M.Tabs value={value} onChange={(_, v) => setValue(v)}>
        <M.Tab label="Download" />
        <M.Tab label="Code" />
      </M.Tabs>
      {value === 0 && download}
      {value === 1 && code}
    </>
  )
}

const TabPanel = ({ children }: { children: React.ReactNode }) => <div>{children}</div>

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
  return (
    <FileView.ZipDownloadForm
      files={selection && Selection.toHandlesList(selection).map(({ key }) => key)}
      suffix={downloadPath}
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
    <TabPanel>
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
    </TabPanel>
  )
}

interface CodePanelProps {
  hashOrTag: string
  uri: Required<Omit<PackageUri.PackageUri, 'tag'>>
}

function CodePanel({ hashOrTag, uri }: CodePanelProps) {
  return (
    <TabPanel>
      <PackageCodeSamples hashOrTag={hashOrTag} {...uri} />
    </TabPanel>
  )
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

  if (hideCode) return download

  const code = <CodePanel hashOrTag={hashOrTag} uri={uri} />
  return <Tabs {...{ download, code }} />
}
