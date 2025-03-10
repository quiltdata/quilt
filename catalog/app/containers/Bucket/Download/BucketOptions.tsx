import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import * as FileView from '../FileView'
import { DirCodeSamples, FileCodeSamples } from '../CodeSamples/Bucket'
import { Tabs, TabPanel } from './OptionsTabs'

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
  dirHandle: Model.S3.S3ObjectLocation
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

interface DownloadPanelProps {
  handle: Model.S3.S3ObjectLocation
}

function DownloadPanel({ handle }: DownloadPanelProps) {
  return handle.version ? (
    <DownloadFile fileHandle={handle} />
  ) : (
    <DownloadDir dirHandle={handle} />
  )
}

interface CodePanelProps {
  handle: Model.S3.S3ObjectLocation
}

function CodePanel({ handle }: CodePanelProps) {
  return handle.version ? (
    <FileCodeSamples bucket={handle.bucket} path={handle.key} />
  ) : (
    <DirCodeSamples bucket={handle.bucket} path={handle.key} />
  )
}

interface OptionsProps {
  handle: Model.S3.S3ObjectLocation
}

export default function Options({ handle }: OptionsProps) {
  return (
    <Tabs labels={['Download', 'Code']}>
      {(activeTab) => (
        <TabPanel>
          {!activeTab ? <DownloadPanel handle={handle} /> : <CodePanel handle={handle} />}
        </TabPanel>
      )}
    </Tabs>
  )
}
