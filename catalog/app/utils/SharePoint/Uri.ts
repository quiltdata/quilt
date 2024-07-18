import type * as Model from 'model'

export function fromSharePointLocation(loc: Model.SharePointLocation) {
  return `sharepoint://${loc.host}/${loc.id}?versionId=${loc.etag}`
}
