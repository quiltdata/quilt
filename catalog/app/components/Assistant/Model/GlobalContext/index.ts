import * as Context from '../Context'

import { useNavigate, useRouteContext } from './navigation'
import { useStackInfo } from './stack'

export function useGlobalContext() {
  Context.usePushContext({
    tools: {
      navigate: useNavigate(),
    },
    messages: [useStackInfo(), useRouteContext()],
  })
}

export { useGlobalContext as use }
