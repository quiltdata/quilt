export interface SkillFile {
  path: string
  text: string
}

export interface GitHubFolder {
  owner: string
  repo: string
  ref?: string
  path: string
}

const MAX_FILES = 50
const MAX_FILE_BYTES = 64 * 1024

/** A GitHub repo, folder, or SKILL.md link, as copied from the browser's address bar. */
export function parseGitHubUrl(input: string): GitHubFolder | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.hostname !== 'github.com') return null
  const [owner, repo, kind, ref, ...rest] = url.pathname.split('/').filter(Boolean)
  if (!owner || !repo) return null
  if (!kind) return { owner, repo: repo.replace(/\.git$/, ''), path: '' }
  if ((kind !== 'tree' && kind !== 'blob') || !ref) return null
  // A link to the SKILL.md itself means the folder holding it.
  const parts = kind === 'blob' ? rest.slice(0, -1) : rest
  return { owner, repo, ref, path: parts.map(decodeURIComponent).join('/') }
}

interface ContentEntry {
  type: 'file' | 'dir' | string
  path: string
  size: number
  download_url: string | null
}

/**
 * Read a skill folder through GitHub's public API, in this browser: the
 * registry is sent the files themselves and never fetches a URL.
 */
export async function fetchGitHubSkill(
  folder: GitHubFolder,
  fetchImpl: typeof fetch = fetch,
): Promise<SkillFile[]> {
  const files: SkillFile[] = []
  const base = `https://api.github.com/repos/${folder.owner}/${folder.repo}/contents`
  const query = folder.ref ? `?ref=${encodeURIComponent(folder.ref)}` : ''

  async function walk(dir: string) {
    const res = await fetchImpl(
      `${base}/${dir.split('/').map(encodeURIComponent).join('/')}${query}`,
    )
    if (!res.ok)
      throw new Error(`GitHub answered ${res.status} for ${dir || 'the repository root'}`)
    const listing: ContentEntry[] | ContentEntry = await res.json()
    if (!Array.isArray(listing))
      throw new Error('That link points to a file, not a folder')
    for (const e of listing) {
      if (e.type === 'dir') {
        await walk(e.path)
        continue
      }
      if (e.type !== 'file' || !e.download_url) continue
      if (files.length >= MAX_FILES)
        throw new Error(`The folder has more than ${MAX_FILES} files`)
      const rel = folder.path ? e.path.slice(folder.path.length + 1) : e.path
      if (e.size > MAX_FILE_BYTES)
        throw new Error(`${rel} is over ${MAX_FILE_BYTES / 1024} KiB`)
      const body = await fetchImpl(e.download_url)
      if (!body.ok) throw new Error(`GitHub answered ${body.status} for ${rel}`)
      const text = await body.text()
      // The listing's size can be stale if the branch moved since it was read.
      if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
        throw new Error(`${rel} is over ${MAX_FILE_BYTES / 1024} KiB`)
      files.push({ path: rel, text })
    }
  }

  await walk(folder.path)
  if (!files.some((f) => f.path === 'SKILL.md'))
    throw new Error('That folder has no SKILL.md at its top level')
  return files
}
