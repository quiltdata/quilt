import cx from 'classnames'
import * as React from 'react'
import { matchPath, match as Match } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Bookmarks from 'containers/Bookmarks/Provider'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'

import * as FileView from './FileView'

const useButtonStyles = M.makeStyles({
  root: {
    padding: '5px',
  },
})

interface ButtonProps extends M.IconButtonProps {
  download?: boolean
  href?: string
  icon: string
}

function Button({ icon, className, ...props }: ButtonProps) {
  const classes = useButtonStyles()
  return (
    <M.IconButton className={cx(classes.root, className)} {...props}>
      <M.Icon>{icon}</M.Icon>
    </M.IconButton>
  )
}

interface BucketButtonProps {
  className: string
  location: Model.S3.S3ObjectLocation
}

function Bookmark({ className, location }: BucketButtonProps) {
  const bookmarks = Bookmarks.use()
  const isBookmarked = location ? bookmarks.isBookmarked('main', location) : false
  const toggleBookmark = () => location && bookmarks.toggle('main', location)
  return (
    <Button
      icon={isBookmarked ? 'turned_in' : 'turned_in_not'}
      className={className}
      title="Bookmark"
      onClick={toggleBookmark}
    />
  )
}

function BucketDirectory({ className, location: { bucket, key } }: BucketButtonProps) {
  return (
    <FileView.ZipDownloadForm suffix={`dir/${bucket}/${key}`} className={className}>
      <Button icon="arrow_downward" title="Download" type="submit" />
    </FileView.ZipDownloadForm>
  )
}

function BucketFile({ className, location }: BucketButtonProps) {
  const url = AWS.Signer.useDownloadUrl(location)
  return (
    <Button
      href={url}
      className={className}
      title="Download"
      download
      icon="arrow_downward"
    />
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
  return (
    <FileView.ZipDownloadForm
      suffix={`package/${bucket}/${name}/${revision}/${path}`}
      className={className}
    >
      <Button icon="arrow_downward" title="Download" type="submit" />
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
  button: {
    padding: '5px',
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
        assertNever(match.path as never)
    }
  }, [paths, to])
}

interface RowActionsProps {
  to: string
  archived?: boolean
  physicalKey?: string
}

export function RowActions({ archived, physicalKey, to }: RowActionsProps) {
  const classes = useRowActionsStyles()
  const { location, handle, revision, path } = useMatchedParams(to)

  if (archived) return <></>

  if (location) {
    const DownloadButton = s3paths.isDir(location.key) ? BucketDirectory : BucketFile
    return (
      <div className={classes.root}>
        <div className={classes.wrapper}>
          <div className={classes.container}>
            <Bookmark className={classes.item} location={location} />
            <DownloadButton className={classes.item} location={location} />
          </div>
        </div>
      </div>
    )
  }

  if (handle) {
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
