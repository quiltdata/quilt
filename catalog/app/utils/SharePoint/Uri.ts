import { parse as parseQs } from 'querystring'
import { parse as parseUrl } from 'url'

import type * as Model from 'model'

export function locationToUri(loc: Model.SharePointLocation) {
  return `s3://sharepoint/${loc.host}/${loc.driveId}/${loc.id}?versionId=${loc.etag}`
}

export function isValidLocation(loc: Model.S3.S3ObjectLocation) {
  return loc.bucket === 'sharepoint'
}

export function isValidUri(uri: string) {
  return uri.startsWith('s3://sharepoint')
}

export function fromPhysicalKey(uri: string) {
  const url = parseUrl(uri)
  if (url.protocol !== 's3:') {
    throw new Error(`Invalid protocol ${url.protocol} SharePoint URI: ${uri}`)
  }
  if (url.host !== 'sharepoint') {
    throw new Error(`Invalid hostname ${url.hostname} in SharePoint URI: ${uri}`)
  }
  if (!url.pathname) {
    throw new Error(`No path in SharePoint URI: ${uri}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
  const [_1, host, driveId, id] = url.pathname.split('/')
  if (!host) {
    throw new Error(`No host in SharePoint URI: ${uri}`)
  }
  if (!driveId) {
    throw new Error(`No driveId in SharePoint URI: ${uri}`)
  }
  if (!id) {
    throw new Error(`No id in SharePoint URI: ${uri}`)
  }
  if (!url.query) {
    throw new Error(`No query in SharePoint URI: ${uri}`)
  }
  const { versionId: etag } = parseQs(url.query)
  if (!etag || Array.isArray(etag)) {
    throw new Error(`Invalid etag "${etag}" in SharePoint URI: ${uri}`)
  }
  return { _tag: 'sharepoint' as const, driveId, etag, host, id }
}
