import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import noop from 'utils/noop'

import QuerySelect from './QuerySelect'

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
})
