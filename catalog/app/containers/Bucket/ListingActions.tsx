import cx from 'classnames'
import * as React from 'react'
import { matchPath, match as Match } from 'react-router-dom'
import * as M from '@material-ui/core'

import {
  ArrowDownwardOutlined as IconArrowDownwardOutlined,
  DeleteOutlined as IconDeleteOutlined,
  TurnedInOutlined as IconTurnedInOutlined,
  TurnedInNotOutlined as IconTurnedInNotOutlined,
} from '@material-ui/icons'

import Code from 'components/Code'
import { useConfirm } from 'components/Dialog'
import * as Bookmarks from 'containers/Bookmarks/Provider'
import * as Notifications from 'containers/Notifications'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import Log from 'utils/Logging'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

import * as FileView from './FileView'
import { deleteObject } from './requests'

const useButtonStyles = M.makeStyles({
  root: {
    padding: '5px',
  },
})

interface BucketButtonProps {
  className: string
  location: Model.S3.S3ObjectLocation
}

function Bookmark({ className, location }: BucketButtonProps) {
  const classes = useButtonStyles()
  const bookmarks = Bookmarks.use()
  if (!bookmarks) return null
  const isBookmarked = location ? bookmarks.isBookmarked('main', location) : false
  const toggleBookmark = () => location && bookmarks.toggle('main', location)
  return (
    <M.IconButton
      className={cx(classes.root, className)}
      onClick={toggleBookmark}
      title="Bookmark"
    >
      {isBookmarked ? <IconTurnedInOutlined /> : <IconTurnedInNotOutlined />}
    </M.IconButton>
  )
}

function Delete({
  className,
  location,
  onDelete,
}: BucketButtonProps & { onDelete: () => void }) {
  const classes = useButtonStyles()

  const s3 = AWS.S3.use()
  const { push } = Notifications.use()

  const onSubmit = React.useCallback(async () => {
    try {
      await deleteObject({ s3, handle: location })
      push(`${s3paths.handleToS3Url(location)} deleted successfully`)
      onDelete()
    } catch (error) {
      Log.error(error)
      push(`Failed deleting ${s3paths.handleToS3Url(location)}`)
    }
  }, [location, onDelete, push, s3])

  const confirm = useConfirm({
    title: 'Delete object?',
    submitTitle: 'Delete',
    onSubmit,
  })

  return (
    <>
      {confirm.render(<Code>{s3paths.handleToS3Url(location)}</Code>)}

      <M.IconButton
        className={cx(classes.root, className)}
        title="Delete"
        onClick={confirm.open}
      >
        <IconDeleteOutlined color="error" />
      </M.IconButton>
    </>
  )
}

function BucketDirectory({ className, location: { bucket, key } }: BucketButtonProps) {
  const classes = useButtonStyles()
  return (
    <FileView.ZipDownloadForm suffix={`dir/${bucket}/${key}`} className={className}>
      <M.IconButton
        className={cx(classes.root, className)}
        title="Download"
        type="submit"
      >
        <IconArrowDownwardOutlined />
      </M.IconButton>
    </FileView.ZipDownloadForm>
  )
}

function BucketFile({ className, location }: BucketButtonProps) {
  const classes = useButtonStyles()
  const url = AWS.Signer.useDownloadUrl(location)
  return (
    <M.IconButton
      className={cx(classes.root, className)}
      href={url}
      title="Download"
      download
    >
      <IconArrowDownwardOutlined />
    </M.IconButton>
  )
}

interface PackageDirectoryProps {
  className: string
  handle: {
    bucket: string
    name: string
  }
  revision: string
  path: string
}

function PackageDirectory({
  className,
  handle: { bucket, name },
  revision,
  path,
}: PackageDirectoryProps) {
  const classes = useButtonStyles()
  return (
    <FileView.ZipDownloadForm
      suffix={`package/${bucket}/${name}/${revision}/${path}`}
      className={className}
    >
      <M.IconButton className={classes.root} title="Download" type="submit">
        <IconArrowDownwardOutlined />
      </M.IconButton>
    </FileView.ZipDownloadForm>
  )
}

interface PackageFileProps {
  className: string
  physicalKey: string
}

function PackageFile({ className, physicalKey }: PackageFileProps) {
  const location = React.useMemo(() => s3paths.parseS3Url(physicalKey), [physicalKey])
  return <BucketFile className={className} location={location} />
}

const useRowActionsStyles = M.makeStyles((t) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'row-reverse',
  },
  container: {
    background: `linear-gradient(
      to right,
      transparent 0,
      ${t.palette.action.hover} ${t.spacing(4)}px,
      ${t.palette.action.hover} 100%)`,
    display: 'flex',
    padding: t.spacing(0, 2, 0, 10),
  },
  item: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  wrapper: {
    '.MuiDataGrid-row:hover &': {
      animation: `$show 150ms ease-out`,
      position: 'absolute',
    },
    background: `linear-gradient(
      to right,
      transparent 0,
      ${t.palette.background.paper} ${t.spacing(4)}px,
      ${t.palette.background.paper} 100%)`,
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

interface BucketMatchParams {
  bucket: string
  path: string
}

interface PackageMatchParams {
  bucket: string
  name: string
  hash?: string
  path: string
}

function useMatchedParams(to: string) {
  const { paths } = NamedRoutes.use()
  return React.useMemo(() => {
    const bucketMatchers = [
      {
        path: paths.bucketFile,
        exact: true,
        strict: true,
      },
      {
        path: paths.bucketDir,
        exact: true,
      },
      {
        path: paths.bucketPackageTree,
        exact: true,
      },
    ]
    const match = bucketMatchers.reduce(
      (memo, matcher) => memo ?? matchPath(to, matcher),
      null as Match<BucketMatchParams | PackageMatchParams> | null,
    )
    if (!match) return {}
    switch (match.path) {
      case paths.bucketFile:
      case paths.bucketDir: {
        const { params } = match as Match<BucketMatchParams>
        return {
          location: {
            bucket: params.bucket,
            key: decodeURIComponent(params.path),
          },
        }
      }
      case paths.bucketPackageTree: {
        const { params } = match as Match<PackageMatchParams>
        return {
          handle: {
            bucket: params.bucket,
            name: params.name,
          },
          revision: params.hash || 'latest',
          path: params.path,
        }
      }
      default:
        throw new Error(`Unexpected path '${match.path}'. Should have been never.`)
    }
  }, [paths, to])
}

interface ListingRowActionsProps {
  to: string
  archived?: boolean
  physicalKey?: string
  prefs: BucketPreferences.ActionPreferences
  onReload: () => void
}

export default function ListingRowActions({
  archived,
  physicalKey,
  to,
  prefs,
  onReload,
}: ListingRowActionsProps) {
  const classes = useRowActionsStyles()
  const { location, handle, revision, path } = useMatchedParams(to)

  if (archived) return <></>

  if (location) {
    const DownloadButton = s3paths.isDir(location.key) ? BucketDirectory : BucketFile
    return (
      <div className={classes.root}>
        <div className={classes.wrapper}>
          <div className={classes.container}>
            <Delete className={classes.item} location={location} onDelete={onReload} />
            <Bookmark className={classes.item} location={location} />
            {prefs.downloadObject && (
              <DownloadButton className={classes.item} location={location} />
            )}
          </div>
        </div>
      </div>
    )
  }

  if (handle && prefs.downloadPackage) {
    return (
      <div className={classes.root}>
        <div className={classes.wrapper}>
          <div className={classes.container}>
            {physicalKey ? (
              <PackageFile className={classes.item} physicalKey={physicalKey} />
            ) : (
              <PackageDirectory
                className={classes.item}
                handle={handle}
                revision={revision}
                path={path}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return <></>
}
