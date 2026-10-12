import * as React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import PackageDescriptionsList from './PackageDescription'

vi.mock('constants/config', () => ({ default: {} }))

describe('components/FileEditor/QuiltConfigEditor/BucketPreferences/PackageDescription', () => {
  it('disables every control, removal included, while disabled', () => {
    const onChange = vi.fn()
    const { container, getAllByRole } = render(
      <PackageDescriptionsList
        disabled
        onChange={onChange}
        size="small"
        value={{ 'team/.*': { message: true } }}
      />,
    )
    const remove = getAllByRole('button', { hidden: true }).find(
      (b) => b.textContent === 'close',
    ) as HTMLButtonElement
    expect(remove.disabled).toBe(true)
    fireEvent.click(remove)
    expect(onChange).not.toHaveBeenCalled()
    container.querySelectorAll('input').forEach((i) => expect(i.disabled).toBe(true))
  })
})
