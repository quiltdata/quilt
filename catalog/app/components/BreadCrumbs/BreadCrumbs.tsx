import * as R from 'ramda'
import * as React from 'react'

import Link from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'

const EMPTY = <i>{'<EMPTY>'}</i>

export const Crumb = tagged.create('app/components/BreadCrumbs:Crumb' as const, {
  Segment: (v: { label?: string; to?: string }) => v,
  Sep: (v: React.ReactNode) => v,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Crumb = tagged.InstanceOf<typeof Crumb>

type LinkPropsConverter = (p: {
  to?: string
}) => React.ComponentProps<typeof Link> | undefined

interface SegmentProps {
  label?: string
  to?: string
  getLinkProps?: LinkPropsConverter
}

export const Segment = ({ label, to, getLinkProps = R.identity }: SegmentProps) =>
  to != null ? (
    <Link {...getLinkProps({ to })}>{label || EMPTY}</Link>
  ) : (
    <>{label || EMPTY}</>
  )

interface RenderOptions {
  getLinkProps?: LinkPropsConverter
}

export const render = (
  items: Crumb[],
  { getLinkProps = undefined }: RenderOptions = {},
) =>
  items.map(
    Crumb.case({
      Segment: (s, i) => (
        <Segment key={`${i}:${s.label}`} getLinkProps={getLinkProps} {...s} />
      ),
      Sep: (s, i) => <React.Fragment key={`__sep${i}`}>{s}</React.Fragment>,
    }),
  )

export const copyWithoutSpaces: React.ClipboardEventHandler<HTMLElement> = (e) => {
  if (typeof document === 'undefined') return
  const crumbsString = document
    ?.getSelection()
    ?.toString()
    ?.replace('<EMPTY>', '')
    ?.replace('ROOT', '')
    ?.replace(/\s*\/\s*/g, '/')
  if (!crumbsString) return
  e.clipboardData?.setData('text/plain', crumbsString)
  e.preventDefault()
}

const DefaultSeparator = Crumb.Sep(<>&nbsp;/ </>)
export function useCrumbs(
  path: string,
  rootLabel: string,
  getRoute: (segPath: string) => string,
): Crumb[] {
  return React.useMemo(
    () =>
      [{ label: rootLabel, path: '' }, ...getBreadCrumbs(path)]
        .map(({ label, path: segPath }) => ({
          label,
          to: segPath === path ? getRoute(segPath) : undefined,
        }))
        .map(Crumb.Segment)
        .reduce(
          (memo, segment, i) =>
            i === 0 ? [segment] : [...memo, DefaultSeparator, segment],
          [] as Crumb[],
        ),
    [getRoute, path, rootLabel],
  )
}
