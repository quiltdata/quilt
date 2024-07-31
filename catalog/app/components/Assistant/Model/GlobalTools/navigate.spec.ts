import { JSONSchema } from '@effect/schema'

import * as Nav from './navigate'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

describe('components/Assistant/Model/GlobalTools/navigate', () => {
  describe('NavigateSchema', () => {
    describe('produced JSON Schema', () => {
      it('should match the snapshot', () => {
        const jsonSchema = JSONSchema.make(Nav.NavigateSchema)
        expect(jsonSchema).toMatchSnapshot()
      })
    })
  })
})
