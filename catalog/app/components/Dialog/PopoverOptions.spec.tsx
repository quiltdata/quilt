import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Tabs } from './PopoverOptions'

const tab = (name: string) => ({ label: name, panel: <span>{name} panel</span> })

describe('components/Dialog/PopoverOptions Tabs', () => {
  afterEach(cleanup)

  // GetOptions drops its Code tab when the `code` prop goes away, so the
  // selected index can outlive the tab it points at.
  it('falls back to the last tab when the selected one disappears', () => {
    const { getByText, queryByText, rerender } = render(
      <Tabs tabs={[tab('Download'), tab('Code')]} />,
    )
    fireEvent.click(getByText('Code'))
    expect(getByText('Code panel')).toBeTruthy()

    rerender(<Tabs tabs={[tab('Download')]} />)
    expect(getByText('Download panel')).toBeTruthy()
    expect(queryByText('Code panel')).toBeNull()

    // Clamping rather than resetting, so a tab that comes back is still the
    // one the user picked.
    rerender(<Tabs tabs={[tab('Download'), tab('Code')]} />)
    expect(getByText('Code panel')).toBeTruthy()
  })
})
