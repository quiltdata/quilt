import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import * as FileView from '../FileView'
import { DirCodeSamples, FileCodeSamples } from '../CodeSamples/Bucket'

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
  quiltSync: {
    padding: t.spacing(0, 0, 2),
    borderBottom: `1px solid ${t.palette.divider}`,
    marginBottom: t.spacing(1),
  },
  tab: {
    padding: t.spacing(2, 2, 1),
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
  bucket: string
  path: string
  fileHandle?: Model.S3.S3ObjectLocation
}

export default function Options({ bucket, fileHandle, path }: OptionsProps) {
  const classes = useStyles()
  const [tab, setTab] = React.useState(0)
  return (
    <div className={classes.root}>
      <M.Paper className={classes.tabsContainer} elevation={1}>
        <M.Button
          className={`${classes.tabButton} ${tab === 0 ? classes.activeTab : ''}`}
          onClick={() => setTab(0)}
        >
          Download
        </M.Button>
        <M.Divider orientation="vertical" />
        <M.Button
          className={`${classes.tabButton} ${tab === 1 ? classes.activeTab : ''}`}
          onClick={() => setTab(1)}
        >
          Code
        </M.Button>
      </M.Paper>
      {tab === 0 && (
        <div className={classes.tab}>
          {fileHandle ? (
            <DownloadFile fileHandle={fileHandle} />
          ) : (
            <FileView.ZipDownloadForm suffix={`dir/${bucket}/${path}`}>
              <M.Button startIcon={<M.Icon>archive</M.Icon>} type="submit">
                Download ZIP (directory)
              </M.Button>
            </FileView.ZipDownloadForm>
          )}
        </div>
      )}
      {tab === 1 &&
        (fileHandle ? (
          <FileCodeSamples className={classes.tab} bucket={bucket} path={path} />
        ) : (
          <DirCodeSamples className={classes.tab} bucket={bucket} path={path} />
        ))}
    </div>
  )
}
