import { describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import * as Skills from './Skills'

const entry = {
  physicalKey: 's3://b/k',
  hash: { type: 'SHA256', value: '' },
  size: 1,
} as any

describe('components/Assistant/Model/Skills', () => {
  describe('parseSource', () => {
    const hash = 'c046d39b4d9c1d7bb0e71ee4d816255bc2f38e29aa4f55b6efb757b3514bc2f6'

    it('accepts a source pinned by hash', () => {
      expect(Skills.parseSource(`quilt+s3://b#package=q/skills@${hash}`)).toMatchObject({
        bucket: 'b',
        name: 'q/skills',
        hash,
      })
    })

    it('rejects an unpinned, empty or malformed source', () => {
      expect(Skills.parseSource('quilt+s3://b#package=q/skills')).toBeNull()
      expect(Skills.parseSource('quilt+s3://b#package=q/skills@latest')).toBeNull()
      expect(Skills.parseSource('quilt+s3://b#package=q/skills@abc123')).toBeNull()
      expect(Skills.parseSource('quilt+s3://b#package=q/skills:latest')).toBeNull()
      expect(Skills.parseSource('')).toBeNull()
      expect(Skills.parseSource('nonsense')).toBeNull()
    })
  })

  describe('parseSkillFile', () => {
    it('splits frontmatter from body', () => {
      const { meta, body } = Skills.parseSkillFile(
        '---\nname: boltz2-nim\ndescription: >\n  Predict structures.\n---\n# Boltz2\n',
      )
      expect(meta).toEqual({ name: 'boltz2-nim', description: 'Predict structures.\n' })
      expect(body).toBe('# Boltz2\n')
    })

    it('treats a file without frontmatter as all body', () => {
      expect(Skills.parseSkillFile('# Just text')).toEqual({
        meta: {},
        body: '# Just text',
      })
    })
  })

  describe('classify', () => {
    it('marks Bash or bundled scripts as needing a shell', () => {
      expect(Skills.classify({ 'allowed-tools': 'Bash, Read' }, [])).toBe('shell')
      expect(Skills.classify({ 'allowed-tools': ['Read', 'Bash'] }, [])).toBe('shell')
      expect(Skills.classify({}, ['SKILL.md', 'scripts/run.py'])).toBe('shell')
    })

    it('leaves instruction-only skills as guides', () => {
      expect(
        Skills.classify({ 'allowed-tools': 'Read' }, ['SKILL.md', 'references/a.md']),
      ).toBe('guide')
    })
  })

  describe('skillDirs', () => {
    it('finds every SKILL.md directory, sorted', () => {
      expect(
        Skills.skillDirs({
          'z/SKILL.md': entry,
          'a/b/SKILL.md': entry,
          'a/b/references/api.md': entry,
          'NOTSKILL.md': entry,
          'SKILL.md': entry,
        }),
      ).toEqual(['a/b/', 'z/'])
    })
  })
})
