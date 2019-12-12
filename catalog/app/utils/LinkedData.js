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

const mkCatalogAnnotation = ({ name, description, buckets, urls }) => ({
  '@context': 'https://schema.org/',
  '@type': 'DataCatalog',
  url: window.location.origin,
  name,
  description,
  dataset: [
    ...buckets.map((b) => ({
      '@type': 'Dataset',
      sameAs: window.location.origin + urls.bucketRoot(b.name),
    })),
    // TODO: expose packages as datasets
  ],
})

function mkBucketAnnotation({ bucket, catalog, urls }) {
  const ld = bucket.linkedData
  return {
    '@context': 'https://schema.org/',
    '@type': 'Dataset',
    name: (ld && ld.name) || bucket.title,
    alternateName: bucket.name,
    description: (ld && ld.description) || bucket.description || undefined,
    url: window.location.origin + urls.bucketRoot(bucket.name),
    sameAs: (ld && ld.sameAs) || undefined,
    identifier: (ld && ld.identifier) || undefined,
    keywords: (ld && ld.keyword) || bucket.tags || undefined,
    creator: (ld && ld.creator) || undefined,
    license: (ld && ld.license) || undefined,
    // TODO: expose packages
    // hasPart: [],
    includedInDataCatalog: catalog ? catalogRef(catalog) : undefined,
  }
}

/* TODO: expose packages as datasets
// render on the package revision (tree) root page
const mkPackageAnnotation = ({ }) => ({
  '@context': 'https://schema.org/',
  '@type': 'Dataset',
  name: TODO,
  description: TODO,
  alternateName: 'package handle',
  // TODO: use proper route
  url: window.location.origin + urls.bucketPackageTree(bucket, handle, revision),
  version: REVISION,
  dateModified: TODO,
  // sameAs: from rest
  // identifier: from rest
  keywords: [], // TODO: from dataset provider
  // creator: from rest
  isPartOf: {
    '@type': 'Dataset',
    sameAs: window.location.origin + urls.bucketRoot(bucket),
  },
  includedInDataCatalog: catalogRef,
})
*/

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
