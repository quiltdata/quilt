import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import type * as BucketPreferences from 'utils/BucketPreferences'
import type * as Defaults from 'utils/BucketPreferences/BucketPreferences'

import RevisionMenu from './RevisionMenu'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<typeof BucketPreferences>(
    'utils/BucketPreferences',
  )
  const { extendDefaults } = await vi.importActual<typeof Defaults>(
    'utils/BucketPreferences/BucketPreferences',
  )
  const prefs = actual.Result.Ok(
    extendDefaults({
      ui: { actions: { deleteRevision: true, revisePackage: true, writeFile: true } },
    }),
  )
  return {
    ...actual,
    use: () => ({
      prefs: prefsResult.current === 'ok' ? prefs : actual.Result.Pending(),
    }),
  }
})

const { prefsResult } = vi.hoisted(() => ({ prefsResult: { current: 'ok' } }))

const f = () => {}

const titles = (props: Partial<React.ComponentProps<typeof RevisionMenu>>) => {
  const menu = render(
    <RevisionMenu
      className=""
      onCreateFile={f}
      onDelete={f}
      onDeletePackage={f}
      {...props}
    />,
  )
  const button = menu.container.querySelector('button')
  if (!button) return []
  fireEvent.click(button)
  return menu.getAllByRole('menuitem').map((i) => i.textContent)
}

describe('containers/Bucket/PackageTree/RevisionMenu', () => {
  it('offers lock alongside the actions the preferences allow', () => {
    expect(titles({ onLock: f })).toEqual([
      'Create file',
      'Delete revision',
      'Delete package',
      'Lock package',
    ])
  })

  it('offers lock while the bucket preferences are not loaded', () => {
    prefsResult.current = 'pending'
    try {
      expect(titles({ onLock: f })).toEqual(['Lock package'])
    } finally {
      prefsResult.current = 'ok'
    }
  })

  it('hides lock without its handler', () => {
    expect(titles({})).toEqual(['Create file', 'Delete revision', 'Delete package'])
  })
})
