import { describe, expect, it, vi } from 'vitest'

import * as Source from './skillSource'

describe('containers/Admin/Settings/skillSource', () => {
  describe('parseGitHubUrl', () => {
    it('reads a folder link', () => {
      expect(
        Source.parseGitHubUrl('https://github.com/o/r/tree/main/Skills/ai-science-x'),
      ).toEqual({ owner: 'o', repo: 'r', ref: 'main', path: 'Skills/ai-science-x' })
    })

    it('reads a SKILL.md link as its folder', () => {
      expect(Source.parseGitHubUrl('https://github.com/o/r/blob/v1/s/SKILL.md')).toEqual({
        owner: 'o',
        repo: 'r',
        ref: 'v1',
        path: 's',
      })
    })

    it('reads a bare repository as its root', () => {
      expect(Source.parseGitHubUrl('https://github.com/o/r.git')).toEqual({
        owner: 'o',
        repo: 'r',
        path: '',
      })
    })

    it('refuses anything but github.com', () => {
      expect(Source.parseGitHubUrl('https://gitlab.com/o/r/tree/main/s')).toBeNull()
      expect(Source.parseGitHubUrl('https://github.com/o/r/issues/1')).toBeNull()
      expect(Source.parseGitHubUrl('not a url')).toBeNull()
    })
  })

  describe('fetchGitHubSkill', () => {
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
    const text = (body: string) => ({ ok: true, status: 200, text: async () => body })

    it('collects every file, paths relative to the skill', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.endsWith('/contents/s?ref=main'))
          return json([
            { type: 'file', path: 's/SKILL.md', size: 10, download_url: 'raw/SKILL.md' },
            { type: 'dir', path: 's/references', size: 0, download_url: null },
          ])
        if (url.endsWith('/contents/s/references?ref=main'))
          return json([
            {
              type: 'file',
              path: 's/references/api.md',
              size: 3,
              download_url: 'raw/api',
            },
          ])
        if (url === 'raw/SKILL.md') return text('---\nname: s\n---')
        if (url === 'raw/api') return text('api')
        throw new Error(url)
      })
      const files = await Source.fetchGitHubSkill(
        { owner: 'o', repo: 'r', ref: 'main', path: 's' },
        fetchImpl as any,
      )
      expect(files).toEqual([
        { path: 'SKILL.md', text: '---\nname: s\n---' },
        { path: 'references/api.md', text: 'api' },
      ])
    })

    it('refuses a folder without a SKILL.md', async () => {
      const fetchImpl = vi.fn(async (url: string) =>
        url.includes('/contents/')
          ? json([{ type: 'file', path: 's/README.md', size: 1, download_url: 'raw' }])
          : text('x'),
      )
      await expect(
        Source.fetchGitHubSkill({ owner: 'o', repo: 'r', path: 's' }, fetchImpl as any),
      ).rejects.toThrow(/no SKILL.md/)
    })

    it('refuses an oversized file before downloading it', async () => {
      const fetchImpl = vi.fn(async () =>
        json([{ type: 'file', path: 's/SKILL.md', size: 70_000, download_url: 'raw' }]),
      )
      await expect(
        Source.fetchGitHubSkill({ owner: 'o', repo: 'r', path: 's' }, fetchImpl as any),
      ).rejects.toThrow(/over 64 KiB/)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('refuses a file whose real body is larger than the listing said', async () => {
      const fetchImpl = vi.fn(async (url: string) =>
        url.includes('/contents/')
          ? json([{ type: 'file', path: 's/SKILL.md', size: 10, download_url: 'raw' }])
          : text('x'.repeat(70_000)),
      )
      await expect(
        Source.fetchGitHubSkill({ owner: 'o', repo: 'r', path: 's' }, fetchImpl as any),
      ).rejects.toThrow(/over 64 KiB/)
    })
  })
})
