import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import type * as Tool from './Tool'
import QURATOR_PROMPT_QUERY from './gql/QuratorPrompt.generated'

/** A tool the registry describes and the client runs. */
export interface ToolSpec {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

/**
 * Qurator's prompt contract, served by the registry (`config.quratorPrompt`):
 * the fixed text each conversation is framed with, and the specs of the
 * catalog's document tools. The registry holds the definitive copy; the
 * catalog fills every slot between the text and runs every tool.
 */
export interface PromptContract {
  readonly version: string
  readonly system: string
  readonly taskContext: string
  readonly taskDescription: string
  readonly conversationStart: string
  readonly conversationEnd: string
  readonly immediateTask: string
  readonly readingGuidance: string
  readonly tools: readonly ToolSpec[]
}

export const UNAVAILABLE =
  'Qurator could not load its instructions from the registry. Reload the page; if it keeps happening, ask an admin to check that the registry is up to date.'

/** The served contract, or null while it loads or when it cannot be read. */
export function useServed(): PromptContract | null {
  const query = GQL.useQuery(QURATOR_PROMPT_QUERY)
  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: (d) => d.config.quratorPrompt ?? null,
        fetching: () => null,
        error: () => null,
      }),
    [query],
  )
}

/**
 * The tools the contract describes that this client can run: each local
 * executor offered under its served description and input schema. Its local
 * decoder still checks every input.
 */
export function servedTools(
  contract: PromptContract | null,
  executors: Record<string, Tool.Descriptor<any>>,
): Tool.Collection {
  if (!contract) return {}
  return Object.fromEntries(
    contract.tools.flatMap((spec) => {
      const local = executors[spec.name]
      if (!local) return []
      const served: Tool.Descriptor<any> = {
        ...local,
        description: spec.description,
        // The registry serves a draft 2020-12 JSON Schema; GraphQL types it as a plain record.
        schema: spec.inputSchema as unknown as Tool.Descriptor<any>['schema'],
      }
      return [[spec.name, served]]
    }),
  )
}
