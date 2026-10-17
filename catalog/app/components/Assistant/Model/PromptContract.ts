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

/**
 * The context marker set while the read of the contract has settled. A turn
 * waits for it, up to WAIT_MS, instead of failing while the contract loads.
 * Contributions register after the first render, so readiness has to be a
 * positive signal: the absence of a "loading" marker would read as ready.
 */
export const SETTLED = 'promptSettled'
export const WAIT_MS = 15_000

export interface Served {
  /** The contract; undefined when the registry did not serve it. */
  readonly contract?: PromptContract
  /** True until the read has a complete result or fails. */
  readonly pending: boolean
}

/** The served contract. A failed read is logged and reported, then reads as absent. */
export function useServed(): Served {
  const query = GQL.useQuery(QURATOR_PROMPT_QUERY)
  return React.useMemo(() => {
    try {
      return GQL.fold(query, {
        data: (d) => ({ contract: d.config.quratorPrompt ?? undefined, pending: false }),
        fetching: () => ({ pending: true }),
      })
    } catch {
      // fold has logged the error and sent it to Sentry before throwing it.
      return { pending: false }
    }
  }, [query])
}

/** Characters of fixed text the contract adds to every prompt. */
export const fixedLength = (c: PromptContract) =>
  c.system.length +
  c.taskContext.length +
  c.taskDescription.length +
  c.conversationStart.length +
  c.conversationEnd.length +
  c.immediateTask.length

/**
 * The tools the contract describes that this client can run: each local
 * executor offered under its served description and input schema. Its local
 * decoder still checks every input.
 */
export function servedTools(
  contract: PromptContract | undefined,
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
