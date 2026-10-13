import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { skillRows } from './Composer'

const skills = (disabled: string[]) => ({
  all: [
    {
      name: 'pkg-curation',
      description: 'Plan a package.',
      runClass: 'guide' as const,
      files: [],
    },
    {
      name: 'geneformer',
      description: 'Tokenize cells.',
      runClass: 'shell' as const,
      files: [],
    },
  ],
  disabled: new Set(disabled),
  toggle: vi.fn(),
})

describe('components/Assistant/UI/Composer skillRows', () => {
  it("draws each row's checkbox from that skill's own state", () => {
    const rows = skillRows(skills(['geneformer']))
    expect(rows.map((r) => r.checked)).toEqual([true, false])
    const icons = rows.map((r) => render(<>{r.end}</>).container.textContent)
    expect(icons[0]).toContain('check_box')
    expect(icons[0]).not.toContain('outline')
    expect(icons[1]).toContain('check_box_outline_blank')
  })

  it('marks a skill needing a shell, and toggles the one selected', () => {
    const s = skills([])
    const rows = skillRows(s)
    expect(render(<>{rows[1].end}</>).container.textContent).toContain('needs shell')
    rows[1].onSelect?.()
    expect(s.toggle).toHaveBeenCalledWith('geneformer')
  })
})
