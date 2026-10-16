import { describe, expect, it } from 'vitest'

import type { Badge } from './badges'
import { badgeUrl, shareText, slackMessage, teamsShareUrl } from './share'

const badge: Badge = {
  id: 'packages-10000',
  title: '10,000 packages',
  description: '10,000 named packages across this stack’s buckets.',
  category: 'Packages',
  icon: 'layers',
  unit: 'count',
  state: { kind: 'earned', at: new Date('2026-03-04T12:00:00Z') },
}

describe('containers/Milestones/share', () => {
  const url = badgeUrl('https://quilt.example.com', badge)
  const text = shareText('quilt.example.com', badge)

  it('links to the badge on the milestones page', () => {
    expect(url).toBe('https://quilt.example.com/milestones#packages-10000')
  })

  it('names the stack, the badge and the date', () => {
    expect(text).toBe(
      'quilt.example.com reached a Quilt milestone: 10,000 packages. 10,000 named packages across this stack’s buckets. Earned Mar 4, 2026.',
    )
  })

  it('builds the Teams share link with the url and message encoded', () => {
    const u = new URL(teamsShareUrl(url, text))
    expect(u.origin + u.pathname).toBe('https://teams.microsoft.com/share')
    expect(u.searchParams.get('href')).toBe(url)
    expect(u.searchParams.get('msgText')).toBe(text)
  })

  it('puts the url on its own line for Slack to unfurl', () => {
    expect(slackMessage(url, text).split('\n')).toEqual([`:trophy: ${text}`, url])
  })
})
