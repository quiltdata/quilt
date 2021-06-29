import * as React from 'react'
import { Helmet } from 'react-helmet'
import * as urql from 'urql'
import type { ResultOf } from '@graphql-typed-document-node/core'

import { useRelevantBucketConfigs } from 'utils/BucketConfig'
import { useConfig } from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'

import BUCKET_CONFIGS_QUERY from './LinkedDataBuckets.generated'

type BucketConfig = Exclude<ResultOf<typeof BUCKET_CONFIGS_QUERY>['bucketConfig'], null>

const catalogRef = (name: string) => ({
  '@type': 'DataCatalog',
  name,
  sameAs: window.location.origin,
})

interface BucketDescriptor {
  name: string
  title: string
  description?: string
  tags?: string[]
  linkedData?: $TSFixMe
}

interface PackageLinkedData {
  name?: string
  description?: string
  sameAs?: string
  identifier?: string
  keywords?: string[]
  creator?: string
  license?: string
}

interface PackageUserMeta {
  'json-ld': PackageLinkedData
}

interface PackageHeader {
  user_meta?: PackageUserMeta
}

interface BucketRootRoutes {
  bucketRoot: [string]
}

interface PackageRoutes {
  bucketPackageTree: [string, string, string]
}

interface MkBucketRefOpts {
  bucket: BucketDescriptor
  urls: NamedRoutes.Urls<BucketRootRoutes>
}

const mkBucketRef = ({ bucket, urls }: MkBucketRefOpts) => ({
  '@type': 'Dataset',
  name: bucket.linkedData?.name || bucket.title,
  alternateName: bucket.name,
  description: bucket.linkedData?.description || bucket.description,
  sameAs: window.location.origin + urls.bucketRoot(bucket.name),
})

interface MkCatalogAnnotationOpts {
  name: string
  description?: string
  buckets: BucketDescriptor[]
  urls: NamedRoutes.Urls<BucketRootRoutes>
}

const mkCatalogAnnotation = ({
  name,
  description,
  buckets,
  urls,
}: MkCatalogAnnotationOpts) => ({
  '@context': 'https://schema.org/',
  '@type': 'DataCatalog',
  url: window.location.origin,
  name,
  description,
  dataset: [
    ...buckets.map((bucket) => mkBucketRef({ bucket, urls })),
    // TODO: expose packages as datasets?
  ],
})

interface MkBucketAnnotationOpts {
  config: BucketConfig
  catalog: string
  urls: NamedRoutes.Urls<BucketRootRoutes>
}

function mkBucketAnnotation({ config, catalog, urls }: MkBucketAnnotationOpts) {
  const ld = config.linkedData as { [k: string]: any } | undefined
  return {
    '@context': 'https://schema.org/',
    '@type': 'Dataset',
    name: ld?.name || config.title,
    alternateName: config.name,
    description: ld?.description || config.description,
    url: window.location.origin + urls.bucketRoot(config.name),
    sameAs: ld?.sameAs,
    identifier: ld?.identifier,
    keywords: ld?.keywords || config.tags,
    creator: ld?.creator,
    license: ld?.license,
    // TODO: expose packages as child datasets?
    // hasPart: [],
    includedInDataCatalog: catalog ? catalogRef(catalog) : undefined,
  }
}

interface MkPackageAnnotationOpts {
  bucket: BucketDescriptor
  name: string
  hash: string
  modified: Date
  header: PackageHeader
  catalog: string
  urls: NamedRoutes.Urls<BucketRootRoutes & PackageRoutes>
}

const mkPackageAnnotation = ({
  bucket,
  name,
  hash,
  modified,
  header,
  catalog,
  urls,
}: MkPackageAnnotationOpts) => {
  const ld = header.user_meta?.['json-ld']
  return {
    '@context': 'https://schema.org/',
    '@type': 'Dataset',
    name: ld?.name || name,
    alternateName: ld?.name && name,
    description: ld?.description,
    url: window.location.origin + urls.bucketPackageTree(bucket.name, name, hash),
    version: hash,
    dateModified: modified,
    sameAs: ld?.sameAs,
    identifier: ld?.identifier,
    keywords: ld?.keywords,
    creator: ld?.creator,
    license: ld?.license,
    isPartOf: mkBucketRef({ bucket, urls }),
    includedInDataCatalog: catalog ? catalogRef(catalog) : undefined,
  }
}

const renderJsonLd = (ld: object) => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(ld)}</script>
  </Helmet>
)

export function CatalogData() {
  const cfg = useConfig()
  const buckets = useRelevantBucketConfigs()
  const { urls } = NamedRoutes.use<BucketRootRoutes>()
  if (!cfg.linkedData?.name) return null
  const ld = mkCatalogAnnotation({ ...cfg.linkedData, buckets, urls })
  return renderJsonLd(ld)
}

interface BucketDataProps {
  bucket: string
}

export function BucketData({ bucket }: BucketDataProps) {
  const cfg = useConfig()
  const { urls } = NamedRoutes.use<BucketRootRoutes>()
  const [{ data }] = urql.useQuery({
    query: BUCKET_CONFIGS_QUERY,
    variables: { bucket },
    pause: !cfg.linkedData,
  })
  if (!cfg.linkedData || !data?.bucketConfig) return null
  const ld = mkBucketAnnotation({
    config: data.bucketConfig,
    catalog: cfg.linkedData.name,
    urls,
  })
  return renderJsonLd(ld)
}

interface PackageDataProps {
  bucket: BucketDescriptor
  name: string
  hash: string
  modified: Date
  header: PackageHeader
}

export function PackageData({ bucket, name, hash, modified, header }: PackageDataProps) {
  const cfg = useConfig()
  const { urls } = NamedRoutes.use<PackageRoutes & BucketRootRoutes>()
  if (!cfg.linkedData) return null
  const ld = mkPackageAnnotation({
    bucket,
    name,
    hash,
    modified,
    header,
    catalog: cfg.linkedData.name,
    urls,
  })
  return renderJsonLd(ld)
}
