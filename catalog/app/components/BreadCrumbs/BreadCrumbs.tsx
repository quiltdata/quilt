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

export function trimSeparatorSpaces(str?: string): string | undefined {
  return str
    ?.replace('<EMPTY>', '')
    ?.replace('ROOT', '')
    ?.replace(/\s*\/\s*/g, '/')
}

export const copyWithoutSpaces: React.ClipboardEventHandler<HTMLElement> = (e) => {
  if (typeof document === 'undefined') return
  const crumbsString = trimSeparatorSpaces(document?.getSelection()?.toString())
  if (!crumbsString) return
  e.clipboardData?.setData('text/plain', crumbsString)
  e.preventDefault()
}

type GetCrumbsFunction = (
  path: string,
  getRoute: (segPath: string) => string,
  rootLabel?: string,
  options?: { skipRoot?: boolean; tailLink?: boolean; tailSeparator?: boolean },
) => Crumb[]

const DefaultSeparator = Crumb.Sep(<>&nbsp;/ </>)
export const getCrumbs: GetCrumbsFunction = (
  path,
  getRoute,
  rootLabel,
  { tailLink = false, tailSeparator = false } = {},
) =>
  (rootLabel
    ? [{ label: rootLabel, path: '' }, ...getBreadCrumbs(path)]
    : getBreadCrumbs(path)
  )
    .map(({ label, path: segPath }) => ({
      label,
      to: path === segPath && !tailLink ? undefined : getRoute(segPath),
    }))
    .map(Crumb.Segment)
    .reduce(
      (memo, segment, i) => (i === 0 ? [segment] : [...memo, DefaultSeparator, segment]),
      [] as Crumb[],
    )
    .concat(tailSeparator ? DefaultSeparator : [])

export const useCrumbs: GetCrumbsFunction = (
  path,
  getRoute,
  rootLabel,
  { tailLink = false, tailSeparator = false } = {},
) =>
  React.useMemo(
    () => getCrumbs(path, getRoute, rootLabel, { tailLink, tailSeparator }),
    [getRoute, path, rootLabel, tailLink, tailSeparator],
  )

export const use = useCrumbs
