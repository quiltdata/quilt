import * as Eff from 'effect'
import * as RR from 'react-router-dom'
import { Schema as S } from '@effect/schema'

import * as Content from '../Content'
import * as Tool from '../Tool'

import { NavigableRouteSchema, navigate } from '../navigation'

export const NavigateSchema = S.Struct({
  route: NavigableRouteSchema,
}).annotations({
  title: 'navigate the catalog',
  description: 'navigate to a provided route',
})

export function useNavigate() {
  const history = RR.useHistory()
  return Tool.useMakeTool(
    NavigateSchema,
    ({ route }) =>
      Eff.pipe(
        navigate(route, history),
        Eff.Effect.match({
          onSuccess: () =>
            Tool.succeed(Content.text(`Navigating to the '${route.name}' route.`)),
          onFailure: (e) =>
            Tool.fail(
              Content.text(`Failed to navigate to the '${route.name}' route: ${e}`),
            ),
        }),
        Eff.Effect.map(Eff.Option.some),
      ),
    [history],
  )
}
