import cfg from 'constants/config'

import type {
  DriveItem,
  DriveItemChildren,
  DriveItemVersionsList,
  Preview,
} from './types'
import { xhrGet, xhrPost } from './xhr'

function baseUrl(host?: string) {
  return host ? `https://${host}/_api/v2.0` : `${cfg.sharePoint.baseUrl}/_api/v2.0`
}

export function versionsList(
  authToken: string,
  driveItemId: string,
  driveId: string,
  host?: string,
): Promise<DriveItemVersionsList> {
  const url = `${baseUrl(host)}/drives/${driveId}/items/${driveItemId}/versions`
  return xhrGet(authToken, url)
}

export function preview(
  authToken: string,
  driveItemId: string,
  driveId: string,
  host?: string,
): Promise<Preview> {
  const url = `${baseUrl(host)}/drives/${driveId}/items/${driveItemId}/preview`
  return xhrPost(authToken, url)
}

export function driveItem(
  authToken: string,
  driveItemId: string,
  driveId: string,
  host?: string,
): Promise<DriveItem> {
  const url = `${baseUrl(host)}/drives/${driveId}/items/${driveItemId}`
  return xhrGet(authToken, url)
}

export function children(
  authToken: string,
  driveItemId: string,
  driveId: string,
  host?: string,
): Promise<DriveItemChildren> {
  const url = `${baseUrl(host)}/drives/${driveId}/items/${driveItemId}/children`
  return xhrGet(authToken, url)
}

export function content(driveItemId: string, driveId: string, host?: string): string {
  return `${baseUrl(host)}/drives/${driveId}/items/${driveItemId}/content`
}
