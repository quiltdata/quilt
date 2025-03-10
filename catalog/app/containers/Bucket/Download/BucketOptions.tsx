import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import * as FileView from '../FileView'
import { DirCodeSamples, FileCodeSamples } from '../CodeSamples/Bucket'
import { Tabs, TabPanel } from './OptionsTabs'

type FileHandle = Model.S3.S3ObjectLocation
type DirHandle = { bucket: string; path: string }
type Handle = FileHandle | DirHandle

function isFile(handle: Handle): handle is FileHandle {
  return 'key' in handle && !!handle.key
}

interface DownloadFileProps {
  fileHandle: FileHandle
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
  dirHandle: DirHandle
}

function DownloadDir({ dirHandle }: DownloadDirProps) {
  return (
    <FileView.ZipDownloadForm suffix={`dir/${dirHandle}/${dirHandle}`}>
      <M.Button startIcon={<M.Icon>archive</M.Icon>} type="submit">
        Download ZIP (directory)
      </M.Button>
    </FileView.ZipDownloadForm>
  )
}

const useDownloadPanelStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(30),
  },
}))

interface DownloadPanelProps {
  handle: Handle
}

function DownloadPanel({ handle }: DownloadPanelProps) {
  const classes = useDownloadPanelStyles()
  return (
    <TabPanel className={classes.root}>
      {isFile(handle) ? (
        <DownloadFile fileHandle={handle} />
      ) : (
        <DownloadDir dirHandle={handle} />
      )}
    </TabPanel>
  )
}

const useCodePanelStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(70),
  },
}))

interface CodePanelProps {
  handle: Handle
}

function CodePanel({ handle }: CodePanelProps) {
  const classes = useCodePanelStyles()
  return (
    <TabPanel className={classes.root}>
      {isFile(handle) ? (
        <FileCodeSamples bucket={handle.bucket} path={handle.key} />
      ) : (
        <DirCodeSamples bucket={handle.bucket} path={handle.path} />
      )}
    </TabPanel>
  )
}

type DisplayOptions =
  | { hideDownload: true; hideCode?: never }
  | { hideDownload?: never; hideCode: true }
  | { hideDownload?: never; hideCode?: never }

type OptionsProps = DisplayOptions & {
  handle: Handle
}

export default function Options({ handle, hideDownload, hideCode }: OptionsProps) {
  if (hideDownload) return <CodePanel handle={handle} />

  if (hideCode) return <DownloadPanel handle={handle} />

  return (
    <Tabs labels={['Download', 'Code']}>
      {(activeTab) =>
        !activeTab ? <DownloadPanel handle={handle} /> : <CodePanel handle={handle} />
      }
    </Tabs>
  )
}
