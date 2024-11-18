import { processBucketAccessCounts } from './Downloads'
import * as stubs from './__stubs__/Downloads'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

describe('containers/Bucket/Overview/Downloads', () => {
  describe('processBucketAccessCounts', () => {
    it('should normalize the data received from GQL and compute some missing data', () => {
      expect(
        processBucketAccessCounts(
          stubs.processBucketAccessCounts as Parameters<
            typeof processBucketAccessCounts
          >[0],
        ),
      ).toMatchSnapshot()
    })
  })
})
