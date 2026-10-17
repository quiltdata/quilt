import * as Eff from 'effect'
import * as React from 'react'

import * as Context from '../Context'
import * as PromptContract from '../PromptContract'
import type * as LLM from '../LLM'

import { useNavigate, useRouteContext } from './navigation'
import { useCatalogPreview } from './preview'
import { useStackInfo } from './stack'
import { useCatalogSummarize } from './summarize'

export function useGlobalContext(llm: Eff.Layer.Layer<LLM.LLM>) {
  const { contract: prompt, pending } = PromptContract.useServed()
  const preview = useCatalogPreview()
  const summarize = useCatalogSummarize(llm)
  const documentTools = React.useMemo(
    () =>
      PromptContract.servedTools(prompt, {
        catalog_preview: preview,
        catalog_summarize: summarize,
      }),
    [prompt, preview, summarize],
  )
  Context.usePushContext({
    prompt: prompt ?? undefined,
    markers: { [Context.PROMPT_SETTLED]: !pending },
    tools: { navigate: useNavigate(), ...documentTools },
    messages: [
      useStackInfo(),
      useRouteContext(),
      ...(prompt ? [prompt.readingGuidance] : []),
    ],
  })
}

export { useGlobalContext as use }
