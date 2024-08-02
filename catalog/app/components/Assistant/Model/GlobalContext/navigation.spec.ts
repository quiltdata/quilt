import { JSONSchema, Schema } from '@effect/schema'

import * as nav from './navigation'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

describe('components/Assistant/Model/GlobalTools/navigation', () => {
  describe('NavigateSchema', () => {
    describe('produced JSON Schema', () => {
      it('should match the snapshot', () => {
        const jsonSchema = JSONSchema.make(nav.NavigateSchema)
        expect(jsonSchema).toMatchSnapshot()
      })
    })
  })
  describe('NavigableRouteSchema', () => {
    it('should decode input', () => {
      const routeInput = {
        name: 'search',
        params: {
          params: {
            resultType: 'o',
          },
        },
      }
      const routeDecoded = Schema.decodeUnknownSync(nav.NavigableRouteSchema)(routeInput)
      expect(routeDecoded).toMatchSnapshot()
    })
  })
})
