import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as Sentry from '@sentry/react'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as Cache from 'utils/ResourceCache'

const CONFIG_KEY = 'catalog/settings.json'

// Pinned to the IAM allowlist in deployment (t4/template/const.py:CATALOG_LOGO_EXTENSIONS).
// SVG is intentionally omitted: inline <script> in SVG executes on direct navigation,
// which is exactly the public-bucket scenario.
const LOGO_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const ACCEPTED_LOGO_MIME_TYPES = Object.keys(LOGO_MIME_TO_EXT)

export class UnsupportedLogoTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported logo file type: ${type || '(unknown)'}`)
    this.name = 'UnsupportedLogoTypeError'
  }
}

export interface CatalogSettings {
  beta?: boolean
  customNavLink?: {
    url: string
    label: string
  }
  logo?: {
    url: string
  }
  search?: {
    mode?: 'packages' | 'objects' | null
  }
  theme?: {
    palette: {
      primary: {
        main: string
      }
    }
  }
}

async function fetchSettings({ s3 }: { s3: S3 }) {
  if (cfg.mode === 'LOCAL') return null

  const location = `s3://${cfg.serviceBucket}/${CONFIG_KEY}`
  try {
    const res = await s3
      .getObject({ Bucket: cfg.serviceBucket, Key: CONFIG_KEY })
      .promise()
    const text = res.Body!.toString('utf-8')
    return JSON.parse(text) as CatalogSettings
  } catch (e) {
    const { code } = e as any
    // assuming this is caused by missing settings file, which is expected
    if (code === 'AccessDenied' || code === 'NoSuchKey') return null
    // eslint-disable-next-line no-console
    console.warn(`Error fetching catalog settings from "${location}":`)
    // eslint-disable-next-line no-console
    console.error(e)
    Sentry.captureException(e, { extra: { location } })
    return null
  }
}

const CatalogSettingsResource = Cache.createResource({
  name: 'CatalogSettings.config',
  fetch: fetchSettings,
  // @ts-expect-error
  key: () => null,
})

function format(settings: CatalogSettings) {
  return JSON.stringify(settings, null, 2)
}

export function useUploadFile() {
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (file: File): Promise<Model.S3.S3ObjectLocation> => {
      const ext = LOGO_MIME_TO_EXT[file.type]
      if (!ext) throw new UnsupportedLogoTypeError(file.type)
      const key = `catalog/logo.${ext}`
      const buf = await file.arrayBuffer()
      const res = await s3
        .putObject({
          Bucket: cfg.serviceBucket,
          Key: key,
          Body: new Uint8Array(buf),
          ContentType: file.type,
        })
        .promise()
      return { bucket: cfg.serviceBucket, key, version: res.VersionId }
    },
    [s3],
  )
}

export function useWriteSettings() {
  const s3 = AWS.S3.use()
  const cache = Cache.use()

  return React.useCallback(
    async (settings: CatalogSettings) => {
      const body = format(settings)
      await s3
        .putObject({ Bucket: cfg.serviceBucket, Key: CONFIG_KEY, Body: body })
        .promise()
      cache.patchOk(CatalogSettingsResource, null, () => settings)
    },
    [s3, cache],
  )
}

export function useCatalogSettings() {
  const s3 = AWS.S3.use()
  return Cache.useData(
    CatalogSettingsResource,
    { s3 },
    { suspend: true },
  ) as CatalogSettings | null
}

export { useCatalogSettings as use }
