import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

import noop from 'utils/noop'

import QuerySelect from './QuerySelect'

// `useId` is Math.random-based and its ids reach the snapshots, so generation
// has to be deterministic. Delegate to the real hook through its `makeId` seam
// instead of replacing it: an id has to stay stable across re-renders, and a
// bare counter hands out a fresh one on every render.
const ids = vi.hoisted(() => ({ n: 0 }))
vi.mock('utils/useId', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/useId')>()
  return { default: () => actual.default(() => `test-id-${(ids.n += 1)}`) }
})
beforeEach(() => {
  ids.n = 0
})

describe('containers/Queries/QuerySelect', () => {
  it('should render', () => {
    const { container } = render(
      <QuerySelect label="Label" queries={[]} onChange={noop} value={null} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
  it('should render with selected value', () => {
    const queries = [
      { key: 'key1', name: 'name1', url: 'url1' },
      { key: 'key2', name: 'name2', url: 'url2' },
    ]
    const { container } = render(
      <QuerySelect label="Label" queries={queries} onChange={noop} value={queries[1]} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  // The two properties that justify the helper living inside the FormControl.
  // Both are easy to lose: `disabled` on the Select instead of the FormControl
  // leaves the helper undimmed, and `aria-describedby` on the Select lands on
  // the hidden native input rather than the focusable one.
  describe('the helper text', () => {
    afterEach(cleanup)

    const renderDisabled = () =>
      render(
        <QuerySelect
          label="Label"
          disabled
          helperText="No saved queries"
          queries={[]}
          onChange={noop}
          value={null}
        />,
      )

    it('dims along with the field it describes', () => {
      const { container } = renderDisabled()
      const helper = container.querySelector('.MuiFormHelperText-root')
      expect(helper?.className).toContain('Mui-disabled')
    })

    it('is referenced by the focusable select node', () => {
      const { container } = renderDisabled()
      const id = container.querySelector('.MuiFormHelperText-root')?.getAttribute('id')
      expect(id).toBeTruthy()
      expect(
        container.querySelector('[role="button"]')?.getAttribute('aria-describedby'),
      ).toBe(id)
    })

    it('leaves no dangling reference when there is no helper', () => {
      const { container } = render(
        <QuerySelect label="Label" queries={[]} onChange={noop} value={null} />,
      )
      expect(container.querySelector('.MuiFormHelperText-root')).toBeNull()
      expect(
        container.querySelector('[role="button"]')?.getAttribute('aria-describedby'),
      ).toBeNull()
    })
  })

  describe('the accessible name', () => {
    afterEach(cleanup)

    it('names the focusable node after the label', () => {
      // The label must reach the role="button" display div through
      // labelId/aria-labelledby -- InputLabel next to a Select names nothing by
      // itself, which reads as "Custom, button" to a screen reader.
      const { getByRole } = render(
        <QuerySelect label="Select a query" queries={[]} onChange={noop} value={null} />,
      )
      expect(getByRole('button', { name: /Select a query/ })).toBeDefined()
    })

    it('keeps the selected query in the name, next to the label', () => {
      // `aria-labelledby` overrides the display div's contents, so pointing it
      // at the label alone drops the selection a sighted user can read.
      const queries = [{ key: 'key1', name: 'name1', url: 'url1' }]
      const { getByRole } = render(
        <QuerySelect
          label="Select a query"
          queries={queries}
          onChange={noop}
          value={queries[0]}
        />,
      )
      expect(getByRole('button', { name: /Select a query/ })).toBeDefined()
      expect(getByRole('button', { name: /name1/ })).toBeDefined()
    })
  })

  describe('the display value under error', () => {
    afterEach(cleanup)

    it('does not claim "Custom" when the load failed', () => {
      // Athena passes value=null for the error state too. "Custom" asserts a
      // hand-written query is loaded, directly beside a helper saying the load
      // failed -- the field must stay blank instead.
      const { container } = render(
        <QuerySelect
          label="Select a query"
          error
          helperText="Failed to load"
          queries={[]}
          onChange={noop}
          value={null}
        />,
      )
      expect(container.querySelector('[role="button"]')?.textContent).not.toContain(
        'Custom',
      )
    })

    it('still reads "Custom" for a genuine no-selection state', () => {
      const { container } = render(
        <QuerySelect label="Select a query" queries={[]} onChange={noop} value={null} />,
      )
      expect(container.querySelector('[role="button"]')?.textContent).toContain('Custom')
    })
  })
})
