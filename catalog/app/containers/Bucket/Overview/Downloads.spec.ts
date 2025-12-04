import { describe, expect, it, vi } from 'vitest'

import { processBucketAccessCounts } from './Downloads'

vi.mock('constants/config', () => ({ default: {} }))

describe('containers/Bucket/Overview/Downloads', () => {
  describe('processBucketAccessCounts', () => {
    it('should normalize the data received from GQL and compute some missing data', () => {
      expect(
        processBucketAccessCounts({
          __typename: 'BucketAccessCounts',
          byExt: [
            {
              __typename: 'AccessCountsGroup',
              ext: 'csv',
              counts: {
                __typename: 'AccessCounts',
                total: 10,
                counts: [
                  {
                    __typename: 'AccessCountForDate',
                    value: 1,
                    date: new Date('2021-08-01'),
                  },
                  {
                    __typename: 'AccessCountForDate',
                    value: 2,
                    date: new Date('2021-08-02'),
                  },
                  {
                    __typename: 'AccessCountForDate',
                    value: 3,
                    date: new Date('2021-08-03'),
                  },
                  {
                    __typename: 'AccessCountForDate',
                    value: 4,
                    date: new Date('2021-08-04'),
                  },
                ],
              },
            },
          ],
          byExtCollapsed: [
            {
              __typename: 'AccessCountsGroup',
              ext: 'csv',
              counts: {
                __typename: 'AccessCounts',
                total: 10,
                counts: [
                  {
                    __typename: 'AccessCountForDate',
                    value: 1,
                    date: new Date('2021-08-01'),
                  },
                  {
                    __typename: 'AccessCountForDate',
                    value: 2,
                    date: new Date('2021-08-02'),
                  },
                  {
                    __typename: 'AccessCountForDate',
                    value: 3,
                    date: new Date('2021-08-03'),
                  },
                  {
                    __typename: 'AccessCountForDate',
                    value: 4,
                    date: new Date('2021-08-04'),
                  },
                ],
              },
            },
          ],
          combined: {
            __typename: 'AccessCounts',
            total: 10,
            counts: [
              {
                __typename: 'AccessCountForDate',
                value: 1,
                date: new Date('2021-08-01'),
              },
              {
                __typename: 'AccessCountForDate',
                value: 2,
                date: new Date('2021-08-02'),
              },
              {
                __typename: 'AccessCountForDate',
                value: 3,
                date: new Date('2021-08-03'),
              },
              {
                __typename: 'AccessCountForDate',
                value: 4,
                date: new Date('2021-08-04'),
              },
            ],
          },
        }),
      ).toEqual({
        byExt: [
          {
            ext: '.csv',
            counts: {
              total: 10,
              counts: [
                {
                  date: new Date('2021-08-01'),
                  value: 1,
                  sum: 1,
                },
                {
                  date: new Date('2021-08-02'),
                  value: 2,
                  sum: 3,
                },
                {
                  date: new Date('2021-08-03'),
                  value: 3,
                  sum: 6,
                },
                {
                  date: new Date('2021-08-04'),
                  value: 4,
                  sum: 10,
                },
              ],
            },
          },
        ],
        byExtCollapsed: [
          {
            ext: '.csv',
            counts: {
              total: 10,
              counts: [
                {
                  date: new Date('2021-08-01'),
                  value: 1,
                  sum: 1,
                },
                {
                  date: new Date('2021-08-02'),
                  value: 2,
                  sum: 3,
                },
                {
                  date: new Date('2021-08-03'),
                  value: 3,
                  sum: 6,
                },
                {
                  date: new Date('2021-08-04'),
                  value: 4,
                  sum: 10,
                },
              ],
            },
          },
        ],
        combined: {
          total: 10,
          counts: [
            {
              date: new Date('2021-08-01'),
              value: 1,
              sum: 1,
            },
            {
              date: new Date('2021-08-02'),
              value: 2,
              sum: 3,
            },
            {
              date: new Date('2021-08-03'),
              value: 3,
              sum: 6,
            },
            {
              date: new Date('2021-08-04'),
              value: 4,
              sum: 10,
            },
          ],
        },
      })
    })
  })
})
