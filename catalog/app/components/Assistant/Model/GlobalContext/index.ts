import * as Context from '../Context'

import { useNavigate, useRouteContext } from './navigation'
import { useGetObject } from './preview'
import { useStackInfo } from './stack'

export function useGlobalContext() {
  Context.usePushContext({
    tools: {
      navigate: useNavigate(),
      catalog_global_getObject: useGetObject(),
    },
    messages: [useStackInfo(), useRouteContext()],
  })
}

export { useGlobalContext as use }
