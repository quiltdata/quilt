import { describe, expect, it } from 'vitest'

import {
  CONNECTOR_ACCESS_LABEL,
  CONNECTOR_ACCESS_ORDER,
  connectorAccessLabelFor,
  connectorTypeLabelFor,
  type ConnectorAccess,
} from './connections'
import type { PlatformKind } from './types'

describe('model/DataProducts/connections', () => {
  describe('connector type', () => {
    it('collapses both Unity bindings onto one connector type', () => {
      // The two bindings differ in how Quilt reads the workspace, not in which
      // exchange it reaches, so a type that split them would offer the admin a
      // distinction with nothing behind it.
      expect(connectorTypeLabelFor('unity-schema')).toBe('Databricks')
      expect(connectorTypeLabelFor('unity-share')).toBe('Databricks')
    })

    it('falls back to the stored kind for a platform this build does not know', () => {
      // A connection's platform comes from stored settings, so it can name a kind
      // added after this build. Showing the raw kind beats rendering "undefined".
      const unknown = 'iceberg-rest' as PlatformKind
      expect(connectorTypeLabelFor(unknown)).toBe('iceberg-rest')
    })
  })

  describe('connector access', () => {
    it('offers every access level, least first', () => {
      // The picker renders this order, so it is behaviour rather than bookkeeping.
      expect(CONNECTOR_ACCESS_ORDER).toEqual(['SUBSCRIBE', 'PUBLISH', 'BOTH'])
      expect(Object.keys(CONNECTOR_ACCESS_LABEL).sort()).toEqual(
        [...CONNECTOR_ACCESS_ORDER].sort(),
      )
    })

    it('never labels an unrecorded direction with an empty string', () => {
      // Rendered after a middot, so an empty label would read as "no restriction".
      const unrecorded = undefined as unknown as ConnectorAccess
      expect(connectorAccessLabelFor(unrecorded)).toBe('Direction not recorded')
    })
  })
})
