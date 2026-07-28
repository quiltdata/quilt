import { describe, expect, it, vi } from 'vitest'

import * as SearchUIModel from '../model'

import { getColumnSortField } from './sort'
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
): Column => ({
  tag: ColumnTag.UserMeta,
  filter,
  predicateType,
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

describe('containers/Search/Table getColumnSortField', () => {
  it('maps system columns to their PackageSystemField', () => {
    expect(getColumnSortField(systemColumn('name'))).toEqual({
      system: SearchUIModel.PackageSystemField.NAME,
      userMeta: null,
    })
    expect(getColumnSortField(systemColumn('modified'))).toEqual({
      system: SearchUIModel.PackageSystemField.MODIFIED,
      userMeta: null,
    })
    expect(getColumnSortField(systemColumn('workflow'))).toEqual({
      system: SearchUIModel.PackageSystemField.WORKFLOW,
      userMeta: null,
    })
  })

  it('rejects the COMMENT system column (text, unsortable)', () => {
    expect(getColumnSortField(systemColumn('comment'))).toBeNull()
  })

  it('maps a typed user-meta column to its JSON pointer', () => {
    expect(getColumnSortField(userMetaColumn('/cell_count', 'Number'))).toEqual({
      system: null,
      userMeta: '/cell_count',
    })
  })

  it('rejects a text-typed user-meta column (analyzed, unsortable)', () => {
    expect(getColumnSortField(userMetaColumn('/notes', 'Text'))).toBeNull()
  })

  it('rejects the bucket column (non-field)', () => {
    expect(getColumnSortField(bucketColumn)).toBeNull()
  })
})
