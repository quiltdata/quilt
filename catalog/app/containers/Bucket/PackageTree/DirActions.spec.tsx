import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import type * as BucketPreferences from 'utils/BucketPreferences'

import DirActions from './DirActions'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<typeof BucketPreferences>(
    'utils/BucketPreferences',
  )
  return { ...actual, use: () => ({ prefs: actual.Result.Pending() }) }
})

const f = () => {}

describe('containers/Bucket/PackageTree/DirActions', () => {
  it('offers Lock while the bucket preferences are pending', () => {
    const { container, getAllByRole, queryByText } = render(
      <DirActions
        className=""
        onCreateFile={f}
        onDelete={f}
        onDeletePackage={f}
        onLock={f}
      >
        {() => 'prefs-gated'}
      </DirActions>,
    )
    expect(queryByText('prefs-gated')).toBeNull()
    const button = container.querySelector('button')
    expect(button).not.toBeNull()
    fireEvent.click(button!)
    expect(getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Lock package'])
  })
})
