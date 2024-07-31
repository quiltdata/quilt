import { Schema, JSONSchema } from '@effect/schema'

import * as Nav from './navigation'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

describe('components/Assistant/Model/GlobalTools/navigation', () => {
  describe('NavigateSchema', () => {
    describe('produced JSON Schema', () => {
      it('should match the snapshot', () => {
        const jsonSchema = JSONSchema.make(Nav.NavigateSchema)
        expect(jsonSchema).toMatchSnapshot()
      })
    })
  })
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
