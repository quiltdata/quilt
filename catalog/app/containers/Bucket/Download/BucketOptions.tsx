import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import * as FileView from '../FileView'

import { DirCodeSamples, FileCodeSamples } from './BucketCodeSamples'
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
    <FileView.ZipDownloadForm suffix={`dir/${dirHandle.bucket}/${dirHandle.path}`}>
      <M.Button startIcon={<M.Icon>archive</M.Icon>} type="submit">
        Download ZIP (directory)
      </M.Button>
    </FileView.ZipDownloadForm>
  )
}

interface DownloadPanelProps {
  handle: Handle
}

function DownloadPanel({ handle }: DownloadPanelProps) {
  return (
    <TabPanel>
      {isFile(handle) ? (
        <DownloadFile fileHandle={handle} />
      ) : (
        <DownloadDir dirHandle={handle} />
      )}
    </TabPanel>
  )
}

interface CodePanelProps {
  handle: Handle
}

function CodePanel({ handle }: CodePanelProps) {
  return (
    <TabPanel>
      {isFile(handle) ? (
        <FileCodeSamples bucket={handle.bucket} path={handle.key} />
      ) : (
        <DirCodeSamples bucket={handle.bucket} path={handle.path} />
      )}
    </TabPanel>
  )
}

interface OptionsProps {
  handle: Handle
  hideCode?: boolean
}

export default function Options({ handle, hideCode }: OptionsProps) {
  const download = <DownloadPanel handle={handle} />

  if (hideCode) return download

  const code = <CodePanel handle={handle} />
  return <Tabs {...{ download, code }} />
}
