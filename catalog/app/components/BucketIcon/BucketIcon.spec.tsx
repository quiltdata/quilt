import * as React from 'react'
import * as M from '@material-ui/core'
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'

import BucketIcon from './'
import { IDENTITY_TINTS, getIdentityTint } from './BucketIcon'

const darkTheme = createMuiTheme({ palette: { type: 'dark' } })

describe('components/BucketIcon', () => {
  afterEach(cleanup)

  describe('should render the inline stub', () => {
    it("when src is ''", () => {
      const { container } = render(<BucketIcon src="" />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('svg')).not.toBeNull()
    })

    it('when src is null', () => {
      const { container } = render(<BucketIcon src={null} />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('svg')).not.toBeNull()
    })
  })

  it('should mark the stub with the contrast class when the theme is dark', () => {
    const { container } = render(
      <MuiThemeProvider theme={darkTheme}>
        <BucketIcon alt="Contrast" src="" />
      </MuiThemeProvider>,
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('contrast')
  })

  it('should not mark the stub with the contrast class in a light theme', () => {
    const { container } = render(<BucketIcon alt="Plain" src="" />)
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain(
      'contrast',
    )
  })

  it('should render custom icons as decorative when no alt', () => {
    const { container } = render(<BucketIcon src="https://custom-src" />)
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
  })

  it('should render custom src as an image', () => {
    const { getByAltText } = render(
      <BucketIcon alt="Custom src" src="https://custom-src" />,
    )
    expect(getByAltText('Custom src').getAttribute('src')).toBe('https://custom-src')
  })

  it('should expose the title on the stub', () => {
    const { getByTitle } = render(<BucketIcon alt="" src="" title="Default icon" />)
    expect(getByTitle('Default icon').closest('svg')).not.toBeNull()
  })

  // DESIGN.md > Colors > Identity Tints declares the properties every pair must
  // hold. Asserted here so adding a tint cannot quietly ship an illegible disc or
  // borrow a reserved hue -- the two ways this palette degrades.
  describe('the identity tint palette', () => {
    const HEX = /^#[0-9a-f]{6}$/
    const channels = (hex: string) => {
      // Assert the format rather than trusting `parseInt`: it yields NaN on bad
      // input, and every comparison against NaN is false, so an illegible pair
      // would filter *out* of a failures list instead of failing the test.
      expect(hex).toMatch(HEX)
      return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    }
    const lum = (hex: string) =>
      channels(hex)
        .map((v) => {
          const c = v / 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
    const contrast = (a: string, b: string) => {
      const [l1, l2] = [lum(a), lum(b)]
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const distance = (a: string, b: string) => {
      const [ca, cb] = [channels(a), channels(b)]
      return Math.hypot(...ca.map((v, i) => v - cb[i]))
    }

    // The Amber Indicator (an identity must never read as a selection), the Info
    // Blue pair, and the Warning Amber pair.
    const RESERVED = ['#fb8c00', '#039be5', '#e1f5fe', '#fff59d', '#f57f17']

    it('carries enough tints to tell a wall of volumes apart', () => {
      expect(IDENTITY_TINTS.length).toBeGreaterThanOrEqual(12)
    })

    it('clears AA for the initials on every ground', () => {
      const ratios = IDENTITY_TINTS.map(({ bg, fg }) => ({
        bg,
        fg,
        ratio: contrast(bg, fg),
      }))
      // Finiteness asserted alongside the floor: a NaN ratio compares false
      // against 4.5 and would otherwise pass as legible.
      ratios.forEach(({ ratio }) => expect(Number.isFinite(ratio)).toBe(true))
      expect(ratios.filter(({ ratio }) => ratio < 4.5)).toEqual([])
    })

    // Not an exact-string match: `#e3f2fd` sat 3.74 from the Info wash and read
    // as it, while the palette's own closest legitimate grounds are 11.70 apart.
    // Distance is the property that keeps an identity from borrowing a meaning.
    it('keeps every tint visibly clear of the reserved hues', () => {
      const tooClose = IDENTITY_TINTS.flatMap(({ bg, fg }) =>
        [bg, fg].flatMap((c) =>
          RESERVED.filter((r) => distance(c, r) < 10).map((r) => ({
            color: c,
            reserved: r,
          })),
        ),
      )
      expect(tooClose).toEqual([])
    })

    // A ground indistinguishable from the app canvas reads as no disc at all.
    it('keeps every ground clear of the app canvas', () => {
      const canvas = '#fafafa'
      expect(IDENTITY_TINTS.filter(({ bg }) => distance(bg, canvas) < 10)).toEqual([])
    })

    it('has no duplicate grounds', () => {
      const grounds = IDENTITY_TINTS.map((t) => t.bg)
      expect(new Set(grounds).size).toBe(grounds.length)
    })
  })

  describe('initials-avatar fallback', () => {
    it('renders initials derived from `label` when there is no src', () => {
      const { getByText } = render(<BucketIcon src={null} label="Genomics Data" />)
      expect(getByText('GD')).toBeTruthy()
    })

    it('takes the first two letters of a single-word label', () => {
      const { getByText } = render(<BucketIcon src={null} label="genomics" />)
      expect(getByText('GE')).toBeTruthy()
    })

    it('falls back to the generic glyph stub when there is no label', () => {
      const { container } = render(<BucketIcon src={null} />)
      expect(container.querySelector('svg')).not.toBeNull()
    })

    it('prefers the custom src image over the label', () => {
      const { getByAltText, container } = render(
        <BucketIcon alt="Custom" src="https://custom-src" label="Genomics Data" />,
      )
      expect(getByAltText('Custom')).toBeTruthy()
      expect(container.querySelector('svg')).toBeNull()
    })

    // The property the admin screens depend on: they render the same bucket the
    // volumes landing does, at a different size and from a different title, so
    // the tint has to key off `tintKey` alone or one bucket wears two marks.
    it('tints from `tintKey`, so one bucket keeps its mark across surfaces', () => {
      const bg = (c: HTMLElement) =>
        (c.querySelector('[class*="initials"]') as HTMLElement).style.backgroundColor

      const landing = render(
        <BucketIcon src={null} label="quilt-bake" tintKey="quilt-bake" size={44} />,
      )
      // The admin table sizes it smaller and the row's title may differ from the
      // name; neither may move the tint.
      const admin = render(
        <BucketIcon src={null} label="Bake Testing" tintKey="quilt-bake" size={32} />,
      )

      expect(bg(landing.container)).toBe(bg(admin.container))
      expect(bg(landing.container)).not.toBe('')
    })

    // Collisions are still possible -- the table is finite -- but the point of
    // its size is that a realistic shared-prefix wall stops reading as a few
    // colors repeating. At six entries these twelve resolved to five tints.
    it('spreads a realistic shared-prefix wall across many tints', () => {
      const names = [
        'quilt-bake',
        'quilt-cellarity',
        'quilt-dev',
        'quilt-exec',
        'quilt-bio-prod',
        'quilt-bio-staging',
        'quilt-ml',
        'quilt-raw',
        'quilt-curated',
        'quilt-archive',
        'quilt-sandbox',
        'quilt-demo',
      ]
      const tints = new Set(names.map((n) => getIdentityTint(n).bg))
      expect(tints.size).toBeGreaterThanOrEqual(8)
    })

    // Not "different buckets get different tints" -- collisions are inevitable
    // and intended. What matters is that the same initials do not force the same
    // tint, so a `quilt-*` wall spreads rather than rendering as one flat color.
    it('spreads shared-prefix buckets across the palette', () => {
      const bg = (label: string, tintKey: string) => {
        const { container } = render(
          <BucketIcon src={null} label={label} tintKey={tintKey} />,
        )
        return (container.querySelector('[class*="initials"]') as HTMLElement).style
          .backgroundColor
      }
      const names = ['quilt-bake', 'quilt-cellarity', 'quilt-dev', 'quilt-exec']
      const tints = new Set(names.map((n) => bg('Quilt Thing', n)))
      expect(tints.size).toBeGreaterThan(1)
    })
  })

  describe('class names', () => {
    const className = 'PRIMARY'
    const classes = {
      custom: 'CUSTOM',
      stub: 'STUB',
    }

    // The palette clears AA at full strength only. The `stub` slot styles the
    // decorative glyph, so a consumer may legitimately dim it; routed onto the
    // initials it would composite the ink toward the row and drop the disc below
    // the floor the palette test certifies. Rendered here the way the admin
    // table renders it, because the array-level AA test cannot see this.
    it('does not dim the initials disc when a consumer dims the glyph slot', () => {
      const useDimmedStub = M.makeStyles({ stub: { opacity: 0.7 } })
      function AdminStyleIcon() {
        return (
          <BucketIcon
            classes={useDimmedStub()}
            src=""
            label="Bake Testing"
            tintKey="quilt-bake"
            title="Default icon"
          />
        )
      }

      const { container } = render(<AdminStyleIcon />)
      const disc = container.querySelector('[class*="initials"]') as HTMLElement
      expect(disc).not.toBeNull()
      expect(disc.className).not.toContain('stub')
      // Unset reads as '' rather than '1' in jsdom, and unset is the passing case.
      expect(window.getComputedStyle(disc).opacity || '1').toBe('1')
    })

    it('should apply className', () => {
      const { getByAltText } = render(
        <BucketIcon alt="Set className" className={className} src="https://custom-src" />,
      )
      expect(getByAltText('Set className').className).toContain('PRIMARY')
    })

    it('should apply custom className if src is set', () => {
      const { getByAltText } = render(
        <BucketIcon
          alt="Custom className"
          className={className}
          classes={classes}
          src="https://custom-src"
        />,
      )
      const img = getByAltText('Custom className')
      expect(img.className).toContain('CUSTOM')
      expect(img.className).toContain('PRIMARY')
      expect(img.className).not.toContain('STUB')
    })

    it('should apply `stub` className if no src', () => {
      const { container } = render(
        <BucketIcon
          alt="Stub className"
          className={className}
          classes={classes}
          src=""
        />,
      )
      const svgClassName = container.querySelector('svg')?.getAttribute('class')
      expect(svgClassName).toContain('STUB')
      expect(svgClassName).toContain('PRIMARY')
      expect(svgClassName).not.toContain('CUSTOM')
    })
  })
})
