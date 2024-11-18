export const processBucketAccessCounts = {
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
}
