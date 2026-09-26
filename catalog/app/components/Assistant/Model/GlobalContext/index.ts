import * as Context from '../Context'

import { useNavigate, useRouteContext } from './navigation'
import { THRESHOLD, useCatalogPreview } from './preview'
import { useStackInfo } from './stack'

const READ_GUIDANCE = [
  '<reading-objects>',
  'Reading S3 objects:',
  '1. Call platform__s3_object_info first to inspect ContentLength and ContentType.',
  '2. For interpretable content use catalog_preview — images of any size, and PDFs,',
  `   Office docs or prose up to ${THRESHOLD / 1024} KiB. It returns thumbnail-resized`,
  '   images and native Document blocks the model can read.',
  '3. For raw bytes, scripting, or text too large for step 2 use platform__object_read',
  '   — it truncates long text and says so.',
  `4. A PDF or Office document over ${THRESHOLD / 1024} KiB cannot be read at all —`,
  '   catalog_preview returns only metadata, platform__object_read only a download',
  '   link. Say so rather than answering from that metadata or from search hits.',
  "Don't read first and decide after; pick the right tool from the metadata.",
  '</reading-objects>',
].join('\n')

export function useGlobalContext() {
  Context.usePushContext({
    tools: {
      navigate: useNavigate(),
      catalog_preview: useCatalogPreview(),
    },
    messages: [useStackInfo(), useRouteContext(), READ_GUIDANCE],
  })
}

export { useGlobalContext as use }
