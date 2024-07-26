import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import Skeleton from 'components/Skeleton'
import type * as Model from 'model'

import { useSharePoint } from './Provider'
import {
  getDownloadUrl,
  DriveItemAttrs,
  loadDriveItemAttrs,
  loadEmbedUrl,
} from './requests'

export const L = Symbol('Loading')

export type EmbedUrl = typeof L | Error | string
export type FileAttrs = typeof L | Error | DriveItemAttrs
export type DownloadUrl = typeof L | Error | string

const useEmbedSkeletonStyles = M.makeStyles((t) => ({
  header: {
    height: t.spacing(6),
  },
  body: {
    padding: '20px',
  },
  content: {
    height: t.spacing(70),
  },
}))

function EmbedSkeleton() {
  const classes = useEmbedSkeletonStyles()
  return (
    <div>
      <Skeleton className={classes.header} />
      <div className={classes.body}>
        <Skeleton className={classes.content} />
      </div>
    </div>
  )
}

const useEmbedPlaceholderStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '600px',
    padding: t.spacing(2),
  },
  header: {
    marginBottom: t.spacing(2),
  },
}))

interface EmbedPlaceholderProps {
  onClick: () => void
}
function EmbedPlaceholder({ onClick }: EmbedPlaceholderProps) {
  const classes = useEmbedPlaceholderStyles()
  return (
    <div className={classes.root}>
      <M.Typography variant="h5" className={classes.header}>
        Unable to obtain SharePoint credentials
      </M.Typography>
      <M.Button onClick={onClick} variant="outlined">
        Click to resolve
      </M.Button>
    </div>
  )
}

interface EmbedProps {
  authToken?: string
  embedUrl?: EmbedUrl
  retry: () => void
}

export function Embed({ embedUrl, retry }: EmbedProps) {
  if (!embedUrl || embedUrl instanceof Error) return <EmbedPlaceholder onClick={retry} />
  if (embedUrl === L) return <EmbedSkeleton />
  return <iframe width="100%" height="600px" src={embedUrl} />
}

interface FilePropertiesProps {
  attrs?: DriveItemAttrs | typeof L | Error
  retry: () => void
  children: (props: DriveItemAttrs) => React.ReactNode
}

export function FileProperties({ attrs, children, retry }: FilePropertiesProps) {
  if (!attrs || attrs instanceof Error) {
    return (
      <div>
        No size, <M.Button onClick={retry}>click!</M.Button>
      </div>
    )
  }
  if (attrs === L) return <M.CircularProgress />
  return <>{children(attrs)}</>
}

function useEmbedUrl(authToken?: string, loc?: Model.SharePointLocation) {
  const [embedUrl, setEmbedUrl] = React.useState<EmbedUrl>()

  React.useEffect(() => {
    async function loadData() {
      if (!loc || !authToken) return
      setEmbedUrl(L)
      try {
        const url = await loadEmbedUrl(authToken, loc)
        setEmbedUrl(url)
      } catch (e) {
        setEmbedUrl(e instanceof Error ? e : new Error('Failed to load embed URL'))
      }
    }
    loadData()
  }, [authToken, loc])

  return embedUrl
}

function useFileAttrs(authToken?: string, loc?: Model.SharePointLocation) {
  const [attrs, setAttrs] = React.useState<FileAttrs>()

  React.useEffect(() => {
    async function loadData() {
      if (!loc || !authToken) return
      setAttrs(L)
      try {
        const loaded = await loadDriveItemAttrs(authToken, loc)
        setAttrs(loaded)
      } catch (e) {
        setAttrs(e instanceof Error ? e : new Error('Failed to load file attributes'))
      }
    }
    loadData()
  }, [authToken, loc])

  return attrs
}

interface DownloadButtonProps {
  className?: string
  downloadUrl?: DownloadUrl
}

export function DownloadButton({ className, downloadUrl }: DownloadButtonProps) {
  if (typeof downloadUrl !== 'string') return <M.CircularProgress />
  // TS can't infer download/href params

  return (
    <Buttons.Iconized
      className={/* @ts-expect-error */ className}
      href={downloadUrl}
      download
      label="Download file"
      icon="arrow_downward"
    />
  )
}

const Ctx = React.createContext(null)

export interface FileProviderRenderProps {
  attrs?: FileAttrs
  downloadUrl?: DownloadUrl
  embedUrl?: EmbedUrl
  retry: () => void
}

interface FileProviderProps {
  children: (v: FileProviderRenderProps) => React.ReactNode
  loc: Model.SharePointLocation
}

export function FileProvider({ loc, children }: FileProviderProps) {
  const { authToken, retry } = useSharePoint(loc.host)
  const embedUrl = useEmbedUrl(authToken, loc)
  const attrs = useFileAttrs(authToken, loc)
  const downloadUrl = getDownloadUrl(loc)
  const renderProps: FileProviderRenderProps = React.useMemo(
    () => ({
      attrs,
      downloadUrl,
      embedUrl,
      retry,
    }),
    [attrs, downloadUrl, embedUrl, retry],
  )
  return <Ctx.Provider value={null}>{children(renderProps)}</Ctx.Provider>
}
