import * as React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'

import WithGlobalDialogs from 'utils/GlobalDialogs'

import QuiltSummarize from './QuiltSummarize'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ bucket: 'b', path: 'quilt_summarize.json' }),
}))

vi.mock('containers/Bucket/requests', () => ({
  useBucketListing: () => async () => ({ bucket: 'b', dirs: [], files: [], path: '' }),
}))

// The data grid does not lay out rows in jsdom; render the picker's cells plainly.
vi.mock('containers/Bucket/Listing', () => ({
  Entry: { Dir: (x: unknown) => x, File: (x: unknown) => x },
  format: () => [{ type: 'file', to: 'picked.md', name: 'picked.md' }],
  Listing: ({ items, CellComponent }: any) =>
    items.map((item: any) => (
      <CellComponent key={item.to} item={item}>
        {item.name}
      </CellComponent>
    )),
}))

const initialValue = JSON.stringify(['foo.md'])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function editor(disabled: boolean, onChange: (v: string) => void) {
  return (
    <WithGlobalDialogs>
      <QuiltSummarize
        disabled={disabled}
        error={null}
        initialValue={initialValue}
        onChange={onChange}
      />
    </WithGlobalDialogs>
  )
}

async function pickAfterLock(lock: boolean) {
  const onChange = vi.fn()
  const view = render(editor(false, onChange))
  await sleep(400)
  onChange.mockClear()
  fireEvent.click(view.getByText('attach_file').closest('button')!)
  await view.findByText('picked.md')
  if (lock) view.rerender(editor(true, onChange))
  fireEvent.click(view.getByText('picked.md'))
  await sleep(400)
  return onChange
}

describe('components/FileEditor/QuiltConfigEditor/QuiltSummarize picker', () => {
  afterEach(cleanup)

  it('applies a picked file', async () => {
    const onChange = await pickAfterLock(false)
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('picked.md')),
    )
  })

  it('ignores a file picked after the editor was disabled', async () => {
    expect(await pickAfterLock(true)).not.toHaveBeenCalled()
  })
})
