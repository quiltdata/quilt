import * as React from 'react'

import * as CatalogSettings from 'utils/CatalogSettings'

/**
 * The catalog's preview-feature registry.
 *
 * Each entry is one independently switchable capability. Admins flip them in
 * Admin > Settings > Preview features, which renders straight off this list --
 * so landing a new preview capability is one entry here plus its read sites,
 * with no admin-panel edit.
 *
 * This is deliberately not `CatalogSettings.beta`. `beta` is a single global
 * switch already wired to four unrelated consumers (bucket Overview V2, the
 * bucket header, Athena's Tabulator tables, and a documented BucketPreferences
 * hook), so it cannot enable one capability without enabling all of them. A
 * slice that needs to be evaluated on its own merits needs its own switch.
 *
 * Storage is `catalog/settings.json` in the service bucket, same as the rest of
 * CatalogSettings: runtime, admin-editable, no redeploy. That also means it is
 * unvalidated JSON, which is why reads below insist on a literal `true`.
 */
export interface Feature {
  /** Switch label in the admin panel. */
  label: string
  /** One line under the switch saying what turning it on actually does. */
  description: string
}

export const FEATURES = {
  'front-door': {
    label: 'New front door',
    description:
      'Replace the volume list at / with the unified search bar and tiles. Off, / is the volume list, unchanged.',
  },
  'elasticsearch-queries': {
    label: 'ElasticSearch query console',
    description:
      'Show the ElasticSearch tab on Queries. Off, Queries is Athena only and /queries/es redirects to it.',
  },
  'data-products': {
    label: 'Data products',
    description:
      'Browse data products defined in an enterprise catalog (AWS DataZone, Databricks Unity, Snowflake). Off, no data-product route or nav entry exists. Reads fixture data until catalog adapters land.',
  },
} satisfies Record<string, Feature>

export type FeatureId = keyof typeof FEATURES

export const FEATURE_IDS = Object.keys(FEATURES) as FeatureId[]

/**
 * Whether `id` is on, given an already-loaded settings document.
 *
 * `null` settings -- LOCAL mode, a missing settings file, or an `AccessDenied`
 * on the service bucket -- all mean "no admin has turned anything on", which is
 * off. The `=== true` is load-bearing rather than defensive: settings are
 * `JSON.parse`d straight to a cast with no schema, so a hand-edited file can put
 * any value under this key, and only a real boolean should open a preview gate.
 */
export function isEnabled(
  settings: CatalogSettings.CatalogSettings | null,
  id: FeatureId,
): boolean {
  return settings?.features?.[id] === true
}

/**
 * Whether `id` is on for this catalog.
 *
 * Suspends on first read, because `CatalogSettings.use()` does. Every existing
 * caller of that hook (the rail, the bare header, the bucket pages) already
 * relies on an ancestor Suspense boundary, so this is safe in the same places --
 * but it is a suspending read, not a plain one.
 *
 * The suspension is the cache's, not the fetch's: ResourceCache creates an entry
 * in `AsyncResult.Init` and defers its fetch a macrotask, and `suspend` throws
 * for `Init` as well as `Pending` (utils/ResourceCache.jsx:130, :155). So the
 * first read suspends even where nothing is fetched -- LOCAL mode returns null
 * before touching S3 and still suspends. Gate this behind whatever mode check
 * would have skipped the fetch, or the wait buys a request that never happens.
 */
export function useFeature(id: FeatureId): boolean {
  const settings = CatalogSettings.use()
  return isEnabled(settings, id)
}

/**
 * Read + write for one flag, for the admin switch.
 *
 * `writeSettings` replaces the whole settings document, so the spread here is
 * what keeps the logo, nav link, theme and search mode from being dropped on the
 * floor every time somebody toggles a preview.
 *
 * That spread is only correct against a document that is still current. `settings`
 * is whatever `CatalogSettings.use()` returned at render, and nothing invalidates
 * it when another admin writes -- so it is passed as `expected` to have the write
 * refuse rather than revert their change. Callers get a
 * `CatalogSettings.SettingsConflictError` to surface; see `useWriteSettings` for
 * why this detects the conflict instead of preventing it.
 */
export function useFeatureSetting(
  id: FeatureId,
): [boolean, (on: boolean) => Promise<void>] {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()
  const set = React.useCallback(
    (on: boolean) =>
      writeSettings(
        {
          ...settings,
          features: { ...settings?.features, [id]: on },
        },
        settings,
      ),
    [id, settings, writeSettings],
  )
  return [isEnabled(settings, id), set]
}
