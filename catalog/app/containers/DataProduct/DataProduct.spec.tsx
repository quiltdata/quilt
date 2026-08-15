import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as M from '@material-ui/core'
import { render as rtlRender, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'
import { FullWidthProvider } from 'components/Layout/Container'

import { PackageMemberRevision, SourcesTable, SourceDeniedScreen } from './DataProduct'
import type { PackageMember } from './packageItems'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/Preview', () => ({}))

// These styles read app-theme extensions (typography.monospace), so render under
// the same theme the app provides; the default MUI theme has no such key.
const render = (ui: React.ReactElement) =>
  rtlRender(
    <M.MuiThemeProvider theme={style.appTheme}>
      <FullWidthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </FullWidthProvider>
    </M.MuiThemeProvider>,
  )

// These three surfaces are the ones with a security or traceability contract
// attached, so they are pulled out of the screen and pinned directly: what the
// refusal must NOT say, and what provenance must say.

afterEach(cleanup)

// Concrete strings the denial state is forbidden to leak. Each is drawn from a
// member of the data product being refused -- a name, a count, a path, a hash.
const SECRETS = ['sensitive/member', 's3://secret-bucket/key.csv', 'deadbeefcafe', '17']

const mkObject = (logicalKey: string, source: object | null = null) =>
  ({
    __typename: 'DataProductObjectMember',
    logicalKey,
    bucket: 'phys-bucket',
    key: `phys/${logicalKey}`,
    versionId: null,
    source,
  }) as any

const mkPackageMember = (
  hashOrTag: string | null,
  resolvedHash: string | null,
): PackageMember =>
  ({
    __typename: 'DataProductPackageMember',
    virtualName: 'virtual/name',
    bucket: 'phys-bucket',
    name: 'phys/pkg',
    hashOrTag,
    resolvedRevision: resolvedHash
      ? { __typename: 'PackageRevision', hash: resolvedHash }
      : null,
    package: null,
  }) as unknown as PackageMember

describe('containers/DataProduct/SourceDeniedScreen', () => {
  // br-source-authorization: a caller who cannot read every member gets no
  // membership at all. The screen exists to say so without becoming the leak it
  // is preventing -- so this asserts on absence, which is the actual contract.
  it('names the product and discloses nothing about its members', () => {
    const { getByTestId, container } = render(<SourceDeniedScreen name="Genomics Q3" />)
    expect(getByTestId('dp-source-denied')).toBeTruthy()
    // The product's own title is fine: the caller could already see it to get here.
    expect(container.textContent).toContain('Genomics Q3')
    SECRETS.forEach((secret) => {
      expect(container.textContent).not.toContain(secret)
    })
  })
})

describe('containers/DataProduct/SourcesTable', () => {
  it('shows source package, revision, and path for each member', () => {
    const { container } = render(
      <SourcesTable
        members={[
          mkObject('a/report.csv', {
            bucket: 'src-bucket',
            packageName: 'team/alpha',
            hash: 'aaaaaaaaaaaaaaaa',
            logicalKey: 'raw/report.csv',
          }),
        ]}
      />,
    )
    const text = container.textContent!
    expect(text).toContain('a/report.csv')
    expect(text).toContain('src-bucket')
    expect(text).toContain('team/alpha')
    // Hash.Trimmed cuts to 12 chars.
    expect(text).toContain('aaaaaaaaaaaa')
    expect(text).toContain('raw/report.csv')
  })

  // The case the whole table exists for: one entry path, two origins. The path
  // column is identical on both rows, so if provenance did not travel with it a
  // reader could not tell which row came from where.
  it('distinguishes two members sharing an entry path across packages', () => {
    const { getAllByRole } = render(
      <SourcesTable
        members={[
          mkObject('alpha/data.csv', {
            bucket: 'src',
            packageName: 'team/alpha',
            hash: 'aaaaaaaaaaaaaaaa',
            logicalKey: 'shared/data.csv',
          }),
          mkObject('beta/data.csv', {
            bucket: 'src',
            packageName: 'team/beta',
            hash: 'bbbbbbbbbbbbbbbb',
            logicalKey: 'shared/data.csv',
          }),
        ]}
      />,
    )
    const rows = getAllByRole('row').slice(1) // drop the header
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('team/alpha')
    expect(rows[1].textContent).toContain('team/beta')
    // Same source path on both -- the package and hash are what separate them.
    rows.forEach((r) => expect(r.textContent).toContain('shared/data.csv'))
  })

  it('says so plainly for a member an author added by hand', () => {
    const { container } = render(
      <SourcesTable
        members={[
          mkObject('manual.csv'),
          mkObject('derived.csv', {
            bucket: 'src',
            packageName: 'team/alpha',
            hash: 'aaaaaaaaaaaaaaaa',
            logicalKey: 'raw/derived.csv',
          }),
        ]}
      />,
    )
    expect(container.textContent).toContain('Added directly')
  })

  // A wholly hand-authored data product has no provenance to trace; a table of
  // "Added directly" rows would be noise.
  it('renders nothing when no member came from a package', () => {
    const { container } = render(<SourcesTable members={[mkObject('manual.csv')]} />)
    expect(container.textContent).toBe('')
  })
})

describe('containers/DataProduct/PackageMemberRevision', () => {
  // The point of resolving pins server-side: a pinned member reports its own
  // revision rather than the word "latest".
  it('shows a pinned member its pinned revision, unqualified', () => {
    const { container } = render(
      <PackageMemberRevision
        member={mkPackageMember('999999aaaabbbbcc', '999999aaaabbbbcc')}
      />,
    )
    expect(container.textContent).toContain('999999aaaabb')
    expect(container.textContent).not.toContain('latest')
  })

  // An unpinned member also gets a concrete hash now, but it is a moving target,
  // so it stays tagged.
  it('shows an unpinned member the resolved hash, tagged latest', () => {
    const { container } = render(
      <PackageMemberRevision member={mkPackageMember(null, 'abcdef1234567890')} />,
    )
    expect(container.textContent).toContain('abcdef123456')
    expect(container.textContent).toContain('(latest)')
  })

  it('falls back to the pin when the member resolved to no revision', () => {
    const { container } = render(
      <PackageMemberRevision member={mkPackageMember('999999', null)} />,
    )
    expect(container.textContent).toBe('999999')
  })
})
