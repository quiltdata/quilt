import * as Context from '../Context'

import { useNavigate, useRouteContext } from './navigation'
import { useCatalogPreview } from './preview'
import { useStackInfo } from './stack'

const READ_GUIDANCE = [
  '<reading-objects>',
  'Reading S3 objects:',
  '1. Call platform__s3_object_info first to inspect ContentLength and ContentType.',
  '2. For interpretable content (images, PDFs, Office docs, prose) use catalog_preview',
  '   — it returns thumbnail-resized images and native Document blocks the model can read.',
  '3. For raw bytes, scripting, or large files use platform__object_read.',
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
