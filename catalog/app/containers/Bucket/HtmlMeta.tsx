import * as R from 'ramda'
import * as React from 'react'
import { Helmet } from 'react-helmet'

interface MetaTitleProps {
  bucket: string
  subtitle?: string
}

function MetaTitle({ bucket, subtitle }: MetaTitleProps) {
  return (
    <Helmet>
      {subtitle ? (
        <title>
          {subtitle} • {bucket} • Quilt
        </title>
      ) : (
        <title>{bucket} • Quilt</title>
      )}
    </Helmet>
  )
}

interface BaseProps {
  bucket: string
}

interface RootProps extends BaseProps {}

export function Root({ bucket }: RootProps) {
  return <MetaTitle bucket={bucket} />
}

interface FileProps extends BaseProps {
  path: string
}

export function File({ bucket, path }: FileProps) {
  const subtitle = path || 'Files'
  return <MetaTitle bucket={bucket} subtitle={subtitle} />
}

export const Dir = File

export const Overview = Root

interface PackageListProps extends BaseProps {}

export function PackageList({ bucket }: PackageListProps) {
  return <MetaTitle bucket={bucket} subtitle="Package list" />
}

interface RevisionsProps extends BaseProps {
  name: string
}

export function Revisions({ bucket, name }: RevisionsProps) {
  return <MetaTitle bucket={bucket} subtitle={name} />
}

interface PackageTreeProps extends BaseProps {
  name: string
  path: string
  revision: string
}

export function PackageTree({ bucket, name, path, revision }: PackageTreeProps) {
  const revisionShortened = R.take(10, revision)
  const subtitle = `${name}@${revisionShortened}/${path}`
  return <MetaTitle bucket={bucket} subtitle={subtitle} />
}

interface QueriesProps extends BaseProps {}

export function Queries({ bucket }: QueriesProps) {
  return <MetaTitle bucket={bucket} subtitle="Queries" />
}

interface SearchProps extends BaseProps {
  query: string
}

export function Search({ bucket, query }: SearchProps) {
  return <MetaTitle bucket={bucket} subtitle={query} />
}
