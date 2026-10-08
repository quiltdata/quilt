import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SectionRail from './SectionRail'

// use-resize-observer requires the ResizeObserver global, which jsdom lacks
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}

    unobserve() {}

    disconnect() {}
  },
)

describe('containers/Bucket/PackageDialog/Inputs/SectionRail', () => {
  const sections = [
    { key: 'required', title: 'Required', status: '1 to fix', tone: 'bad' as const },
    { key: 'optional', title: 'Optional', status: '0 of 2' },
    { key: 'other', title: 'Other fields', status: '3' },
  ]

  it('lists each section with its status and the required progress', () => {
    render(
      <SectionRail sections={sections} summary={{ done: 2, total: 5 }}>
        <div data-section="required" />
      </SectionRail>,
    )
    const nav = screen.getByRole('navigation', { name: 'Metadata sections' })
    expect(nav.textContent).toContain('Required1 to fix')
    expect(nav.textContent).toContain('Other fields3')
    expect(nav.textContent).toContain('2 of 5 required')
  })

  it('marks the clicked section current and scrolls its card into view', () => {
    const scroll = vi.fn()
    render(
      <SectionRail sections={sections}>
        <div data-section="required" />
        <div data-section="optional" ref={(el) => el && (el.scrollIntoView = scroll)} />
      </SectionRail>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Optional/ }))
    expect(scroll).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /Optional/ }).getAttribute('aria-current'),
    ).toBe('true')
  })
})
