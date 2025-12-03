import * as Eff from 'effect'
import { vi } from 'vitest'

import { makeJSONSchema } from '../Tool'

import * as nav from './navigation'

vi.mock('constants/config', () => ({}))

describe('components/Assistant/Model/GlobalTools/navigation', () => {
  describe('NavigateSchema', () => {
    describe('produced JSON Schema', () => {
      it('should match the snapshot', () => {
        const jsonSchema = makeJSONSchema(nav.NavigateSchema)
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
              latestOnly: true,
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
      {
        route: {
          name: 'bucket.prefix',
          params: {
            bucket: 'quilt-example',
            path: 'data/random-data-benchmark/100kb/',
          },
        },
        loc: {
          pathname: '/b/quilt-example/tree/data/random-data-benchmark/100kb/',
          search: '',
          hash: '',
        },
      },
    ]

    const encode = Eff.flow(
      Eff.Schema.decodeUnknown(nav.NavigableRouteSchema),
      Eff.Effect.andThen(nav.locationFromRoute),
      Eff.Effect.runPromise,
    )

    TEST_CASES.forEach((tc, i) => {
      describe(`${i + 1}: ${tc.route.name}`, () => {
        it('should encode', async () => {
          expect(await encode(tc.route)).toEqual(tc.loc)
        })
        it('should decode', async () => {
          expect(nav.matchLocation(tc.loc)?.decoded).toEqual(tc.route)
        })
      })
    })
  })
})
