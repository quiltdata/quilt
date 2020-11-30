import * as R from 'ramda'
import * as React from 'react'
import { Helmet } from 'react-helmet'

import { useRelevantBucketConfigs } from 'utils/BucketConfig'
import { useConfig } from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'

const catalogRef = (name) => ({
  '@type': 'DataCatalog',
  name,
  sameAs: window.location.origin,
})

function mkBucketRef({ bucket, urls }) {
  const getLD = (prop) => R.path(['linkedData', prop], bucket)
  return {
    '@type': 'Dataset',
    name: getLD('name') || bucket.title,
    alternateName: bucket.name,
    description: getLD('description') || bucket.description,
    sameAs: window.location.origin + urls.bucketRoot(bucket.name),
  }
}

const mkCatalogAnnotation = ({ name, description, buckets, urls }) => ({
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

function mkBucketAnnotation({ bucket, catalog, urls }) {
  const getLD = (prop) => R.path(['linkedData', prop], bucket)
  return {
    '@context': 'https://schema.org/',
    '@type': 'Dataset',
    name: getLD('name') || bucket.title,
    alternateName: bucket.name,
    description: getLD('description') || bucket.description,
    url: window.location.origin + urls.bucketRoot(bucket.name),
    sameAs: getLD('sameAs'),
    identifier: getLD('identifier'),
    keywords: getLD('keywords') || bucket.tags,
    creator: getLD('creator'),
    license: getLD('license'),
    // TODO: expose packages as child datasets?
    // hasPart: [],
    includedInDataCatalog: catalog ? catalogRef(catalog) : undefined,
  }
}

const mkPackageAnnotation = ({ bucket, name, hash, modified, header, catalog, urls }) => {
  const getLD = (prop) => R.path(['user_meta', 'json-ld', prop], header)
  return {
    '@context': 'https://schema.org/',
    '@type': 'Dataset',
    name: getLD('name') || name,
    alternateName: getLD('name') && name,
    description: getLD('description'),
    url: window.location.origin + urls.bucketPackageTree(bucket.name, name, hash),
    version: hash,
    dateModified: modified,
    sameAs: getLD('sameAs'),
    identifier: getLD('identifier'),
    keywords: getLD('keywords'),
    creator: getLD('creator'),
    license: getLD('license'),
    isPartOf: mkBucketRef({ bucket, urls }),
    includedInDataCatalog: catalog ? catalogRef(catalog) : undefined,
  }
}

const renderJsonLd = (ld) => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(ld)}</script>
  </Helmet>
)

export function CatalogData() {
  const cfg = useConfig()
  const buckets = useRelevantBucketConfigs()
  const { urls } = NamedRoutes.use()
  if (!cfg.linkedData || !cfg.linkedData.name) return null
  const ld = mkCatalogAnnotation({ ...cfg.linkedData, buckets, urls })
  return renderJsonLd(ld)
}

export function BucketData({ bucket }) {
  const cfg = useConfig()
  const { urls } = NamedRoutes.use()
  if (!cfg.linkedData) return null
  const ld = mkBucketAnnotation({ bucket, catalog: cfg.linkedData.name, urls })
  return renderJsonLd(ld)
}

export function PackageData({ bucket, name, revision, hash, modified, header }) {
  const cfg = useConfig()
  const { urls } = NamedRoutes.use()
  if (!cfg.linkedData) return null
  const ld = mkPackageAnnotation({
    bucket,
    name,
    revision,
    hash,
    modified,
    header,
    catalog: cfg.linkedData.name,
    urls,
  })
  return renderJsonLd(ld)
}
