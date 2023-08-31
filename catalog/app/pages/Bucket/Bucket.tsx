import invariant from 'invariant'
import * as React from 'react'
import { Outlet, matchPath, useLocation, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { useBucketExistence } from 'utils/BucketCache'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'

import BucketNav, { BucketNavSection } from 'containers/Bucket/BucketNav'
import CatchNotFound from 'containers/Bucket/CatchNotFound'
import { displayError } from 'containers/Bucket/errors'

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

interface BucketLayoutProps {
  bucket: string
  children: React.ReactNode
  section?: BucketNavSection
}

function BucketLayout({ bucket, section, children }: BucketLayoutProps) {
  const classes = useStyles()
  const bucketExistenceData = useBucketExistence(bucket)
  return (
    <Layout
      pre={
        <>
          <M.AppBar position="static" className={classes.appBar}>
            <BucketNav bucket={bucket} section={section} />
          </M.AppBar>
          <M.Container maxWidth="lg">
            {bucketExistenceData.case({
              Ok: () => children,
              Err: displayError(),
              _: () => <Placeholder color="text.secondary" />,
            })}
          </M.Container>
        </>
      }
    />
  )
}

function useSection(): BucketNavSection | undefined {
  const location = useLocation()
  const { paths } = NamedRoutes.use()
  return React.useMemo(() => {
    const sections = {
      [paths.bucketDir]: 'tree',
      [paths.bucketESQueries]: 'es',
      [paths.bucketFile]: 'tree',
      [paths.bucketOverview]: 'overview',
      [paths.bucketPackageDetail]: 'packages',
      [paths.bucketPackageList]: 'packages',
      [paths.bucketPackageRevisions]: 'packages',
      [paths.bucketPackageTree]: 'packages',
      [paths.bucketQueries]: 'queries',
    }
    for (const pattern in sections) {
      if (matchPath(pattern, location.pathname))
        return sections[pattern] as BucketNavSection
    }
  }, [location.pathname, paths])
}

export default function Bucket() {
  const location = useLocation()
  const { bucket } = useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const section = useSection()
  return (
    <BucketPreferences.Provider bucket={bucket}>
      <MetaTitle>{bucket}</MetaTitle>
      <BucketLayout bucket={bucket} section={section}>
        <CatchNotFound id={`${location.pathname}${location.search}${location.hash}`}>
          <Outlet />
        </CatchNotFound>
      </BucketLayout>
    </BucketPreferences.Provider>
  )
}

export const Component: React.FC = Bucket
