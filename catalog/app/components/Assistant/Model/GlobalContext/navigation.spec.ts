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
    it('should decode input', async () => {
      const routeInput = {
        name: 'search',
        params: {
          searchString: '',
          buckets: [],
          order: 'NEWEST',
          params: {
            resultType: 'p',
            filter: [],
            userMetaFilters: [
              {
                path: '/author',
                predicate: {
                  type: 'KeywordEnum',
                  value: {
                    terms: ['Aneesh', 'Maksim'],
                  },
                },
              },
            ],
          },
        },
      }
      const routeDecoded = Schema.decodeUnknownSync(nav.NavigableRouteSchema)(routeInput)
      expect(routeDecoded).toMatchSnapshot()

      const route = nav.routes[routeDecoded.name]
      // @ts-expect-error
      const loc = await Schema.encodePromise(route.paramsSchema)(routeDecoded.params)
      expect(loc).toMatchSnapshot()
    })
  })
})
