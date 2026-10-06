import type AWSSDK from 'aws-sdk'
import * as Eff from 'effect'
import { Schema as S } from 'effect'
import yaml from 'js-yaml'
import * as React from 'react'

import cfg from 'constants/config'
import type { PackageContentsFlatMap } from 'model'
import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'
import log from 'utils/Logging'
import * as PackageUri from 'utils/PackageUri'
import * as s3paths from 'utils/s3paths'

import * as Content from './Content'
import * as Context from './Context'
import * as Tool from './Tool'
import SKILLS_SOURCE_QUERY from './gql/SkillsSource.generated'

/**
 * What a skill needs to run as written. Qurator has no shell, so a `shell`
 * skill can only guide: the model explains the steps and hands the user the
 * commands, never claims to have run them.
 */
export type RunClass = 'guide' | 'shell'

export interface Skill {
  name: string
  description: string
  runClass: RunClass
  /** Package-relative directory holding `SKILL.md`, with a trailing slash. */
  dir: string
}

const SKILL_FILE = 'SKILL.md'
const MAX_SKILLS = 50
const MAX_DESCRIPTION = 400
const MAX_FILE_SIZE = 64 * 1024
const DISABLED_KEY = 'QUILT_QURATOR_SKILLS_DISABLED'

/** The stack's pinned skills package, or `null` when unset or not pinned by hash. */
export function parseSource(uri: string | undefined): PackageUri.PackageUri | null {
  if (!uri) return null
  try {
    const parsed = PackageUri.parse(uri)
    // An unpinned source would let whoever can push the package change the prompt;
    // the registry resolves anything but a full hash (e.g. `@latest`) as a moving pointer.
    return parsed.hash && /^[0-9a-f]{64}$/.test(parsed.hash) ? parsed : null
  } catch {
    return null
  }
}

/** Split `SKILL.md` into its YAML frontmatter and markdown body. */
export function parseSkillFile(text: string): {
  meta: Record<string, unknown>
  body: string
} {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: text }
  const meta = yaml.load(m[1])
  return {
    meta: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {},
    body: m[2],
  }
}

export function classify(
  meta: Record<string, unknown>,
  files: readonly string[],
): RunClass {
  const tools = meta['allowed-tools']
  const toolList = Array.isArray(tools) ? tools.join(' ') : String(tools ?? '')
  if (/\bBash\b/.test(toolList)) return 'shell'
  if (files.some((f) => f.startsWith('scripts/'))) return 'shell'
  return 'guide'
}

/** Logical keys of the skill directories in a package, at most `MAX_SKILLS`. */
export function skillDirs(entries: PackageContentsFlatMap): string[] {
  return Object.keys(entries)
    .filter((k) => k.endsWith(`/${SKILL_FILE}`))
    .map((k) => k.slice(0, -SKILL_FILE.length))
    .sort()
    .slice(0, MAX_SKILLS)
}

const readText = (s3: AWSSDK.S3, entry: { physicalKey: string; size: number }) => {
  const loc = s3paths.parseS3Url(entry.physicalKey)
  return s3
    .getObject({
      Bucket: loc.bucket,
      Key: loc.key,
      VersionId: loc.version,
      // S3 refuses a Range on an empty object.
      Range: entry.size > MAX_FILE_SIZE ? `bytes=0-${MAX_FILE_SIZE - 1}` : undefined,
    })
    .promise()
    .then((r) => r.Body?.toString('utf-8') ?? '')
}

function useDisabled() {
  const [disabled, setDisabled] = React.useState<ReadonlySet<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(DISABLED_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })
  const toggle = React.useCallback((name: string) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (!next.delete(name)) next.add(name)
      try {
        localStorage.setItem(DISABLED_KEY, JSON.stringify([...next]))
      } catch {
        // per-viewer convenience only
      }
      return next
    })
  }, [])
  return [disabled, toggle] as const
}

function toPromptBlock(skills: readonly Skill[]) {
  return [
    '<skills>',
    'Skills are instruction bundles your administrator made available.',
    'When a request matches a skill, call skill_load with its name before answering',
    'and follow it. Load a reference file it names with skill_load(skill, file) only',
    'when you need it.',
    'You cannot run shell commands, scripts, Docker or external APIs. For a skill',
    'marked [shell], explain the steps and give the user the commands to run',
    'themselves; never say you ran them.',
    ...skills.map(
      (s) =>
        `- ${s.name}${s.runClass === 'shell' ? ' [shell]' : ''}: ${s.description.slice(0, MAX_DESCRIPTION)}`,
    ),
    '</skills>',
  ].join('\n')
}

const SkillLoadSchema = S.Struct({
  skill: S.String.annotations({ description: 'Skill name, as listed in <skills>' }),
  file: S.optional(
    S.String.annotations({
      description: `Path inside the skill, e.g. references/api.md. Omit for ${SKILL_FILE}.`,
    }),
  ),
}).annotations({
  description: `Load a skill's instructions (${SKILL_FILE}) or one of its reference files.`,
})

const text = (t: string) => Content.ToolResultContentBlock.Text({ text: t })

export function useSkills() {
  const source = React.useMemo(() => parseSource(cfg.quratorSkills), [])
  const s3 = AWS.S3.use()
  const query = GQL.useQuery(
    SKILLS_SOURCE_QUERY,
    { bucket: source?.bucket ?? '', name: source?.name ?? '', hash: source?.hash ?? '' },
    { pause: !source },
  )
  const entries = GQL.fold(query, {
    data: (d) =>
      d.package?.revision?.hash === source?.hash
        ? (d.package?.revision?.contentsFlatMap ?? null)
        : null,
    fetching: () => null,
    error: () => null,
  })

  const unavailable = !!source && !query.fetching && !entries
  React.useEffect(() => {
    if (unavailable)
      log.warn(
        `Qurator skills: can't read ${cfg.quratorSkills} (missing, not readable, or over 1000 entries)`,
      )
  }, [unavailable])

  const [all, setAll] = React.useState<readonly Skill[]>([])
  React.useEffect(() => {
    if (!entries) return
    let cancelled = false
    Promise.all(
      skillDirs(entries).map(async (dir): Promise<Skill | null> => {
        try {
          const { meta } = parseSkillFile(
            await readText(s3, entries[`${dir}${SKILL_FILE}`]),
          )
          const files = Object.keys(entries)
            .filter((k) => k.startsWith(dir))
            .map((k) => k.slice(dir.length))
          const name = typeof meta.name === 'string' ? meta.name : dir.replace(/\/$/, '')
          const description = typeof meta.description === 'string' ? meta.description : ''
          return {
            name,
            description: description.trim(),
            runClass: classify(meta, files),
            dir,
          }
        } catch (e) {
          log.warn(`Qurator skills: skipped ${dir}${SKILL_FILE}`, e)
          return null
        }
      }),
    ).then((skills) => {
      if (cancelled) return
      // Names key the toggles and `skill_load`, so the first of a duplicate wins.
      const seen = new Set<string>()
      setAll(
        skills.filter((s): s is Skill => !!s && !seen.has(s.name) && !!seen.add(s.name)),
      )
    })
    return () => {
      cancelled = true
    }
  }, [entries, s3])

  const [disabled, toggle] = useDisabled()
  const enabled = React.useMemo(
    () => all.filter((s) => !disabled.has(s.name)),
    [all, disabled],
  )

  const skillLoad = Tool.useMakeTool(
    SkillLoadSchema,
    ({ skill, file }) =>
      Eff.Effect.gen(function* () {
        const found = enabled.find((s) => s.name === skill)
        if (!found || !entries)
          return Eff.Option.some(Tool.fail(text(`No enabled skill "${skill}"`)))
        const key = `${found.dir}${file?.replace(/^\.?\//, '') ?? SKILL_FILE}`
        const entry = entries[key]
        if (!entry)
          return Eff.Option.some(Tool.fail(text(`"${file}" is not in skill "${skill}"`)))
        const body = yield* Eff.Effect.tryPromise({
          try: () => readText(s3, entry),
          catch: (e) => e as Error,
        })
        const truncated = entry.size > MAX_FILE_SIZE ? '\n[truncated]' : ''
        return Eff.Option.some(Tool.succeed(text(body + truncated)))
      }).pipe(
        Eff.Effect.catchAll((e) =>
          Eff.Effect.succeed(
            Eff.Option.some(
              Tool.fail(text(`Couldn't read the skill file: ${e.message}`)),
            ),
          ),
        ),
      ),
    [enabled, entries, s3],
  )

  Context.usePushContext(
    React.useMemo(
      () =>
        enabled.length
          ? { messages: [toPromptBlock(enabled)], tools: { skill_load: skillLoad } }
          : {},
      [enabled, skillLoad],
    ),
  )

  return React.useMemo(() => ({ all, disabled, toggle }), [all, disabled, toggle])
}
