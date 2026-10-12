import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const query = vi.hoisted(() => ({ current: {} as any }))
const fileQuery = vi.hoisted(() => vi.fn())
const pushed = vi.hoisted(() => ({ current: {} as any }))

vi.mock('utils/GraphQL', async (importActual) => ({
  ...(await importActual<typeof import('utils/GraphQL')>()),
  useQuery: () => query.current,
}))

vi.mock('urql', async (importActual) => ({
  ...(await importActual<typeof import('urql')>()),
  useClient: () => ({
    query: (...args: any[]) => ({ toPromise: () => fileQuery(...args) }),
  }),
}))

vi.mock('./Context', () => ({
  usePushContext: (ctx: any) => {
    pushed.current = ctx
  },
}))

import * as Skills from './Skills'

const SKILLS = [
  {
    name: 'pkg-curation',
    description: 'Plan a package.',
    runClass: 'GUIDE',
    files: ['SKILL.md', 'references/api.md'],
  },
  {
    name: 'geneformer',
    description: 'Tokenize cells.',
    runClass: 'SHELL',
    files: ['SKILL.md'],
  },
]

const loaded = (skills = SKILLS) => ({
  data: { config: { quratorSkills: { topHash: 'h', skills } } },
  fetching: false,
  stale: false,
})

function setup() {
  const box: { current: ReturnType<typeof Skills.useSkills> | null } = { current: null }
  function Harness() {
    box.current = Skills.useSkills()
    return null
  }
  render(<Harness />)
  return () => box.current!
}

const load = (input: { skill: string; file?: string }): Promise<any> =>
  Eff.Effect.runPromise(pushed.current.tools.skill_load.executor(input)).then((r: any) =>
    Eff.Option.getOrThrow(r),
  )

describe('components/Assistant/Model/Skills', () => {
  beforeEach(() => {
    localStorage.clear()
    pushed.current = {}
    fileQuery.mockReset()
  })
  afterEach(cleanup)

  it('offers no skills and no tool while none are approved', () => {
    query.current = loaded([])
    const skills = setup()
    expect(skills().all).toEqual([])
    expect(pushed.current).toEqual({})
  })

  it('lists approved skills to the model, marking the ones needing a shell', () => {
    query.current = loaded()
    setup()
    const [block] = pushed.current.messages
    expect(block).toContain('- pkg-curation: Plan a package.')
    expect(block).toContain('- geneformer [shell]: Tokenize cells.')
    expect(block).toContain('never say you ran them')
    expect(pushed.current.tools.skill_load).toBeDefined()
  })

  it('drops a turned-off skill from the prompt, and remembers it', () => {
    query.current = loaded()
    const skills = setup()
    act(() => skills().toggle('geneformer'))
    expect(pushed.current.messages[0]).not.toContain('geneformer')
    cleanup()
    setup()
    expect(pushed.current.messages[0]).not.toContain('geneformer')
  })

  it("reads a skill's file through the registry", async () => {
    query.current = loaded()
    setup()
    fileQuery.mockResolvedValue({ data: { quratorSkillFile: '# ref' } })
    const r = await load({ skill: 'pkg-curation', file: './references/api.md' })
    expect(r.status).toBe('success')
    expect(r.content[0].text).toBe('# ref')
    expect(fileQuery).toHaveBeenCalledWith(expect.anything(), {
      name: 'pkg-curation',
      path: 'references/api.md',
    })
  })

  it('refuses a file the skill does not list, without asking the registry', async () => {
    query.current = loaded()
    setup()
    const r = await load({ skill: 'pkg-curation', file: '../other/SKILL.md' })
    expect(r.status).toBe('error')
    expect(fileQuery).not.toHaveBeenCalled()
  })

  it('refuses a turned-off skill', async () => {
    query.current = loaded()
    const skills = setup()
    act(() => skills().toggle('geneformer'))
    const r = await load({ skill: 'geneformer' })
    expect(r.status).toBe('error')
    expect(fileQuery).not.toHaveBeenCalled()
  })

  it('reports a registry failure as a tool error', async () => {
    query.current = loaded()
    setup()
    fileQuery.mockResolvedValue({ error: { message: 'boom' } })
    const r = await load({ skill: 'pkg-curation' })
    expect(r.status).toBe('error')
    expect(r.content[0].text).toContain('boom')
  })
})
