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
  /**
   * The global beta switch. Absent means ON: the surfaces it gates (bucket
   * header, current Overview, Athena's Tabulator tables) ship by default, and
   * a catalog opts out by storing `false`. Read through `isBetaEnabled` rather
   * than directly, so the default lives in one place — a missing settings file
   * or an `AccessDenied` on the service bucket must not read as opted out.
   */
  beta?: boolean
  customNavLink?: {
    url: string
    label: string
  }
  // Per-capability preview switches, one key per entry in the `utils/features`
  // registry. Typed as an open record rather than the registry's `FeatureId`
  // union on purpose: this module must not import `utils/features`, which
  // imports this one. The registry owns the narrowing and the reads.
  //
  // Keys for capabilities that no longer exist are inert, so retiring a flag is
  // deleting its registry entry -- no settings migration.
  features?: Record<string, boolean>

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

/**
 * Someone else wrote `catalog/settings.json` between the read this write was
 * built from and the write itself.
 *
 * Thrown instead of writing, because writing would destroy their change: every
 * settings write replaces the whole document, so a write built from a stale read
 * silently reverts every field the other admin touched.
 *
 * Callers surface this to the admin rather than treating it as a transport
 * failure -- the write did not fail, it was refused, and the fix is to reload
 * and reapply rather than to retry.
 */
export class SettingsConflictError extends Error {
  constructor() {
    super(
      'Catalog settings were changed by someone else. Reload the page and reapply your change.',
    )
    this.name = 'SettingsConflictError'
  }
}

/**
 * Whether the document we are about to overwrite is still the one we read.
 *
 * A deep compare of the parsed JSON, not an ETag: see `useWriteSettings` for why
 * there is no version token to compare instead. Key order is not significant --
 * both sides come from `JSON.parse`, and a reordering with identical content is
 * not a conflict -- so this normalizes through sorted-key serialization rather
 * than comparing raw text.
 */
function sameDocument(a: CatalogSettings | null, b: CatalogSettings | null) {
  const norm = (v: CatalogSettings | null): string =>
    v == null
      ? 'null'
      : JSON.stringify(v, (_k, val) =>
          val && typeof val === 'object' && !Array.isArray(val)
            ? Object.keys(val)
                .sort()
                .reduce<Record<string, unknown>>((acc, k) => {
                  acc[k] = val[k]
                  return acc
                }, {})
            : val,
        )
  return norm(a) === norm(b)
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

/**
 * Write the whole settings document, refusing to clobber a concurrent change.
 *
 * Every caller builds its argument by spreading the settings it read at render
 * (`{...settings, theme}`, `R.dissoc('customNavLink', settings)`, ...), so the
 * write carries not just the field being edited but a snapshot of every other
 * field as it looked at read time. Two admins editing different fields therefore
 * do not merge: whoever writes second reverts the first. With two preview
 * switches now in this document, that is a routine switch flip rather than a rare
 * deliberate settings edit.
 *
 * **This is a conflict-detecting read-before-write, not a compare-and-swap, and
 * it narrows the race rather than closing it.** A true CAS is unreachable here:
 * `aws-sdk` is pinned to v2 (2.1646.0) and its `PutObjectRequest` has no
 * `IfMatch`/`IfNoneMatch`/`ETag`/`VersionId` field -- the only `IfMatch` in the
 * S3 typings belong to `GetObjectRequest` and `HeadObjectRequest`. So S3's
 * conditional-write support cannot be expressed through the typed client, and
 * smuggling a raw header past the type system in a frozen SDK would be an
 * untestable side channel. There remains a window between the check below and the
 * PUT in which a third write can land; a writer that loses inside that window is
 * still lost silently. Closing it needs a real precondition.
 *
 * If aws-sdk v3 (or another client exposing conditional writes) lands here, the
 * upgrade path is: have `fetchSettings` keep `res.ETag` -- it currently reads
 * only `res.Body` and drops it -- thread that token through the cached resource,
 * and pass it as `IfMatch` on the PUT. Then this function's re-read becomes
 * unnecessary and the check becomes atomic.
 *
 * @throws {SettingsConflictError} if the stored document changed since `expected`
 *   was read. The write is not attempted; the caller is expected to tell the
 *   admin to reload.
 */
export function useWriteSettings() {
  const s3 = AWS.S3.use()
  const cache = Cache.use()

  return React.useCallback(
    async (settings: CatalogSettings, expected?: CatalogSettings | null) => {
      // `expected === undefined` means the caller did not claim to know the prior
      // state, so there is nothing to compare and no conflict to detect. That is
      // distinct from `null`, which is a real claim: "there was no settings file
      // when I read". Callers that spread a prior document should always pass it.
      if (expected !== undefined) {
        const current = await fetchSettings({ s3 })
        if (!sameDocument(current, expected)) throw new SettingsConflictError()
      }
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

/**
 * Whether the global beta switch is on, given an already-loaded document.
 *
 * Absent means ON; a present key must be a literal `true` to stay on. The
 * asymmetry is the point: settings are `JSON.parse`d straight to a cast with no
 * schema, so a hand-edited `"false"` or `0` under this key is someone trying to
 * opt out, and anything but `true` therefore lands on the legacy surfaces
 * rather than overriding their intent. Same `=== true` discipline as
 * `utils/features`, with the default inverted — a preview nobody asked for
 * stays off, whereas these surfaces ship unless a catalog asks otherwise.
 *
 * Known gap: `fetchSettings` maps `AccessDenied` to `null` alongside a genuinely
 * absent file, so a catalog that stored `beta: false` still reads as ON for a
 * principal that cannot read the settings object. Closing that needs the fetch
 * to distinguish the two, which is more than a default flip.
 */
export function isBetaEnabled(settings: CatalogSettings | null): boolean {
  return settings?.beta === undefined ? true : settings.beta === true
}

export function useBetaEnabled(): boolean {
  return isBetaEnabled(useCatalogSettings())
}
