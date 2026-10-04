import * as Eff from 'effect'

import * as Context from '../Context'
import type * as LLM from '../LLM'

import { useNavigate, useRouteContext } from './navigation'
import { THRESHOLD, useCatalogPreview } from './preview'
import { useStackInfo } from './stack'
import { useCatalogSummarize } from './summarize'

const READ_GUIDANCE = [
  '<reading-objects>',
  'Reading S3 objects:',
  '1. Call platform__s3_object_info first to inspect ContentLength and ContentType.',
  '2. For interpretable content use catalog_preview — images of any size, and PDFs,',
  `   Office docs or prose up to ${THRESHOLD / 1024} KiB. It returns thumbnail-resized`,
  '   images and native Document blocks the model can read.',
  '3. For raw bytes, scripting, or text too large for step 2 use platform__object_read',
  '   — it truncates long text and says so.',
  `4. For a PDF, Office or HTML document over ${THRESHOLD / 1024} KiB, or long text,`,
  '   Markdown or CSV that needs summarizing, use catalog_summarize. It reports how',
  '   much of the document it read; pass that on rather than implying more. If it',
  '   cannot read the document, say so rather than answering from metadata or',
  '   search hits.',
  "Don't read first and decide after; pick the right tool from the metadata.",
  '</reading-objects>',
].join('\n')

export function useGlobalContext(llm: Eff.Layer.Layer<LLM.LLM>) {
  Context.usePushContext({
    tools: {
      navigate: useNavigate(),
      catalog_preview: useCatalogPreview(),
      catalog_summarize: useCatalogSummarize(llm),
    },
    messages: [useStackInfo(), useRouteContext(), READ_GUIDANCE],
  })
}

export { useGlobalContext as use }
