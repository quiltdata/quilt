import * as Eff from 'effect'
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
  describe('routes', () => {
    const TEST_CASES = [
      {
        route: {
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
        },
        loc: {
          pathname: '/search',
          search: 'o=NEWEST&meta.e%2Fauthor=%22Aneesh%22%2C%22Maksim%22',
          hash: '',
        },
      },
      {
        route: {
          name: 'bucket.overview',
          params: {
            bucket: 'test-bucket',
          },
        },
        loc: {
          pathname: '/b/test-bucket',
          search: '',
          hash: '',
        },
      },
    ]

    const encode = Eff.flow(
      Schema.decodeUnknown(nav.NavigableRouteSchema),
      Eff.Effect.andThen(nav.locationFromRoute),
      Eff.Effect.runPromise,
    )

    for (let i in TEST_CASES) {
      const tc = TEST_CASES[i]
      describe(`${i + 1}: ${tc.route.name}`, () => {
        it('should encode', async () => {
          const loc = await encode(tc.route)
          expect(loc).toEqual(tc.loc)
        })
      })
    }
  })
})
