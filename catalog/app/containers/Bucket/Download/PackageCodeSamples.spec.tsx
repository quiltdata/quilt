import * as React from 'react'
import { render } from '@testing-library/react'

import PackageCodeSamples from './PackageCodeSamples'

jest.mock(
  './Code',
  () =>
    ({ label, help, lines }: { label: string; help: string; lines: string[] }) => (
      <dl key={label} data-help={help}>
        <dt>{label}:</dt>
        {lines.map((l, i) => (
          <dd key={`${l}_${i}`}>{l}</dd>
        ))}
      </dl>
    ),
)

describe('containers/Bucket/CodeSamples/Package', () => {
  it('renders catalog property', () => {
    const props = {
      bucket: 'bucket',
      name: 'name',
      hash: 'hash',
      hashOrTag: 'tag',
      path: 'path',
      catalog: 'catalog',
    }
    const { container } = render(<PackageCodeSamples {...props} />)
    expect(container).toMatchSnapshot()
  })
})
