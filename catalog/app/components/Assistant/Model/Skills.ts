import * as Eff from 'effect'
import { Schema as S } from 'effect'
import * as React from 'react'
import * as urql from 'urql'

import * as GQL from 'utils/GraphQL'

import * as Content from './Content'
import * as Context from './Context'
import * as Tool from './Tool'
import QURATOR_SKILL_FILE_QUERY from './gql/QuratorSkillFile.generated'
import QURATOR_SKILLS_QUERY from './gql/QuratorSkills.generated'

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
  files: readonly string[]
}

const SKILL_FILE = 'SKILL.md'
const MAX_DESCRIPTION = 400
const DISABLED_KEY = 'QUILT_QURATOR_SKILLS_DISABLED'

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

export function toPromptBlock(skills: readonly Skill[]) {
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
  const query = GQL.useQuery(QURATOR_SKILLS_QUERY)
  const all: readonly Skill[] = React.useMemo(
    () =>
      GQL.fold(query, {
        data: (d) =>
          (d.config.quratorSkills?.skills ?? []).map((s) => ({
            name: s.name,
            description: s.description,
            runClass: s.runClass === 'SHELL' ? ('shell' as const) : ('guide' as const),
            files: s.files,
          })),
        fetching: () => [],
        error: () => [],
      }),
    [query],
  )

  const [disabled, toggle] = useDisabled()
  const enabled = React.useMemo(
    () => all.filter((s) => !disabled.has(s.name)),
    [all, disabled],
  )

  const client = urql.useClient()
  const skillLoad = Tool.useMakeTool(
    SkillLoadSchema,
    ({ skill, file }) =>
      Eff.Effect.gen(function* () {
        const found = enabled.find((s) => s.name === skill)
        if (!found) return Eff.Option.some(Tool.fail(text(`No enabled skill "${skill}"`)))
        const path = file?.replace(/^\.?\//, '') ?? SKILL_FILE
        if (!found.files.includes(path))
          return Eff.Option.some(
            Tool.fail(
              text(
                `"${path}" is not in skill "${skill}"; it has ${found.files.join(', ')}`,
              ),
            ),
          )
        const result = yield* Eff.Effect.promise(() =>
          client
            // An admin may replace a skill under the same name; a cached body would outlive it.
            .query(
              QURATOR_SKILL_FILE_QUERY,
              { name: skill, path },
              { requestPolicy: 'network-only' },
            )
            .toPromise(),
        )
        const body = result.data?.quratorSkillFile
        if (result.error || body == null)
          return Eff.Option.some(
            Tool.fail(
              text(
                `Couldn't read the skill file: ${result.error?.message ?? 'not found'}`,
              ),
            ),
          )
        return Eff.Option.some(Tool.succeed(text(body)))
      }),
    [enabled, client],
    'read',
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
