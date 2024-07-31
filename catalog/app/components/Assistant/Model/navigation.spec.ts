import { Schema } from '@effect/schema'

import * as Nav from './navigation'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

describe('components/Assistant/Model/navigation', () => {
  describe('NavigableRouteSchema', () => {
    it('shoult decode input', () => {
      const routeInput = {
        name: 'search',
        params: {
          params: {
            resultType: 'o',
          },
        },
      }
      const routeDecoded = Schema.decodeUnknownSync(Nav.NavigableRouteSchema)(routeInput)
      expect(routeDecoded).toMatchSnapshot()
    })
  })
})
