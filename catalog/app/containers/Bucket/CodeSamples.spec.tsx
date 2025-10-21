import * as React from 'react'
import { render } from '@testing-library/react'

import { CliFetch } from './CodeSamples'

jest.mock(
  'containers/Bucket/Download/Code',
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

describe('containers/Bucket/CodeSamples', () => {
  describe('CliFetch', () => {
    it('shows lines with --recursive for directories', () => {
      const bucket = 'test-bucket'
      const dest = 'local-dest'

      const { queryByText } = render(
        <CliFetch className="test-class" bucket={bucket} path="folder/" dest={dest} />,
      )
      expect(
        queryByText('aws s3 cp --recursive "s3://test-bucket/folder/" "./local-dest"'),
      ).toBeTruthy()
    })

    it('shows lines with no --recursive for files', () => {
      const bucket = 'test-bucket'
      const dest = 'local-dest'

      const { queryByText } = render(
        <CliFetch className="test-class" bucket={bucket} path="file.txt" dest={dest} />,
      )
      expect(
        queryByText('aws s3 cp "s3://test-bucket/file.txt" "./local-dest"'),
      ).toBeTruthy()
    })
  })
})
