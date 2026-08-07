import { describe, expect, it, vi } from 'vitest'

import * as SearchUIModel from '../model'

import { columnSortState, getColumnOrderingBase, orderingForColumn } from './sort'
import { ColumnTag } from './useColumns'
import type { Column } from './useColumns'

vi.mock('constants/config', () => ({ default: {} }))

const state = { filtered: false, visible: true, inferred: false }

const systemColumn = (
  filter: string,
  predicateType: SearchUIModel.KnownPredicate['_tag'] = 'Text',
): Column =>
  ({
    tag: ColumnTag.SystemMeta,
    filter,
    fullTitle: filter,
    predicateType,
    state,
    title: filter,
  }) as Column

const userMetaColumn = (
  filter: string,
  predicateType: SearchUIModel.KnownPredicate['_tag'],
  sortable: boolean,
): Column => ({
  tag: ColumnTag.UserMeta,
  filter,
  predicateType,
  sortable,
  state,
  title: filter,
})

const bucketColumn: Column = {
  tag: ColumnTag.Bucket,
  filter: 'bucket',
  fullTitle: 'Bucket',
  state,
  title: 'Bucket',
}

describe('containers/Search/Table getColumnOrderingBase', () => {
  it('maps system columns to their `sys:<field>` base', () => {
    expect(getColumnOrderingBase(systemColumn('name'))).toBe('sys:name')
    expect(getColumnOrderingBase(systemColumn('modified'))).toBe('sys:modified')
    expect(getColumnOrderingBase(systemColumn('workflow'))).toBe('sys:workflow')
  })

  it('rejects the COMMENT system column (text, unsortable)', () => {
    expect(getColumnOrderingBase(systemColumn('comment'))).toBeNull()
  })

  it('maps a sortable user-meta column to its `usr:<pointer>:<type>` base', () => {
    // Number facet → `number` token.
    expect(getColumnOrderingBase(userMetaColumn('/cell_count', 'Number', true))).toBe(
      'usr:/cell_count:number',
    )
    // Datetime facet → `datetime` token.
    expect(getColumnOrderingBase(userMetaColumn('/date', 'Datetime', true))).toBe(
      'usr:/date:datetime',
    )
  })

  it('rejects an unsortable user-meta column (analyzed text, unsortable)', () => {
    expect(getColumnOrderingBase(userMetaColumn('/notes', 'Text', false))).toBeNull()
  })

  it('maps a Text-rendered but sortable user-meta column (demoted high-cardinality keyword) to a `text` token', () => {
    // A high-cardinality keyword renders as a Text facet (predicateType 'Text')
    // yet sorts natively — the gate keys on `sortable`, not the render type. Its
    // token is `text`, which the server resolves against keyword-backed storage.
    expect(getColumnOrderingBase(userMetaColumn('/lineage', 'Text', true))).toBe(
      'usr:/lineage:text',
    )
  })

  it('rejects the bucket column (non-field)', () => {
    expect(getColumnOrderingBase(bucketColumn)).toBeNull()
  })
})

describe('containers/Search/Table columnSortState', () => {
  it('is inactive for a null base or a relevance/preset ordering', () => {
    expect(columnSortState(null, 'sys:name:asc')).toEqual({
      active: false,
      descending: false,
    })
    expect(columnSortState('sys:name', null)).toEqual({
      active: false,
      descending: false,
    })
    expect(columnSortState('sys:name', 'sys:modified:desc')).toEqual({
      active: false,
      descending: false,
    })
  })

  it('detects the active direction when the ordering targets the column', () => {
    expect(columnSortState('sys:name', orderingForColumn('sys:name', 'asc'))).toEqual({
      active: true,
      descending: false,
    })
    expect(columnSortState('sys:name', orderingForColumn('sys:name', 'desc'))).toEqual({
      active: true,
      descending: true,
    })
  })
})
