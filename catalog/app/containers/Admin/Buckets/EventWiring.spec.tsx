import * as React from 'react'
import { ThemeProvider } from '@material-ui/core/styles'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as style from 'constants/style'

import EventWiring, { currentWiring, rulePattern, Today } from './EventWiring'

describe('containers/Admin/Buckets/EventWiring', () => {
  it('reads the mode the bucket record encodes', () => {
    expect(currentWiring(null)).toEqual({ kind: 'unconfigured' })
    expect(currentWiring('DO_NOT_SUBSCRIBE')).toEqual({ kind: 'skipped' })
    expect(
      currentWiring('arn:aws:sns:us-east-1:123456789012:b-QuiltNotifications-abc'),
    ).toEqual({
      kind: 'topic',
      arn: 'arn:aws:sns:us-east-1:123456789012:b-QuiltNotifications-abc',
      region: 'us-east-1',
      account: '123456789012',
      managed: true,
    })
    expect(currentWiring('arn:aws:sns:eu-west-1:210987654321:fanout')).toMatchObject({
      managed: false,
      account: '210987654321',
    })
    expect(
      currentWiring('arn:aws-us-gov:sns:us-gov-west-1:210987654321:t'),
    ).toMatchObject({
      region: 'us-gov-west-1',
    })
    expect(currentWiring('')).toEqual({ kind: 'unconfigured' })
    expect(currentWiring('not-an-arn')).toEqual({ kind: 'unparsed', arn: 'not-an-arn' })
  })

  it('keeps .quilt/ in a prefix-scoped rule', () => {
    expect(rulePattern('b', ['data/']).detail).toEqual({
      bucket: { name: ['b'] },
      object: { key: [{ prefix: 'data/' }, { prefix: '.quilt/' }] },
    })
    expect(rulePattern('b', ['.quilt/']).detail).toEqual({
      bucket: { name: ['b'] },
      object: { key: [{ prefix: '.quilt/' }] },
    })
    expect(rulePattern('b', null).detail).toEqual({ bucket: { name: ['b'] } })
    expect(rulePattern('b', ['']).detail).toEqual({ bucket: { name: ['b'] } })
  })

  it('asks for a valid data account and keeps .quilt/ in a scoped rule', () => {
    render(
      <ThemeProvider theme={style.appTheme}>
        <EventWiring
          bucket="b"
          prefixes={['data/']}
          snsNotificationArn={null}
          open
          onClose={() => {}}
        />
      </ThemeProvider>,
    )
    try {
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent).toContain('"prefix": ".quilt/"')
      expect(dialog.textContent).toContain(
        'live updates then cover only the scoped prefixes',
      )
      expect(dialog.textContent).not.toContain('Data account ID')
      fireEvent.click(screen.getByLabelText('Another account'))
      fireEvent.change(screen.getByLabelText('Data account ID'), {
        target: { value: '1234' },
      })
      expect(dialog.textContent).toContain('Enter a 12-digit AWS account ID')
      fireEvent.change(screen.getByLabelText('Data account ID'), {
        target: { value: '123456789012' },
      })
      expect(dialog.textContent).not.toContain('Enter a 12-digit AWS account ID')
      expect(dialog.textContent).toContain('an admin of account 123456789012 deploys')
    } finally {
      cleanup()
    }
  })

  it.each([
    [{ kind: 'skipped' } as const, 'without touching its notification targets'],
    [{ kind: 'unconfigured' } as const, 'removing its other targets'],
    [
      currentWiring('arn:aws:sns:us-east-1:123456789012:b-QuiltNotifications-abc'),
      'Quilt-named SNS topic',
    ],
    [
      currentWiring('arn:aws:sns:us-east-1:123456789012:fanout'),
      'the registry didn’t create it',
    ],
    [
      currentWiring('arn:aws:sns:us-east-1:123456789012:fanout'),
      'swap it for a new Quilt topic',
    ],
  ])('describes %j', (wiring, sentence) => {
    const { container } = render(<Today wiring={wiring} />)
    try {
      expect(container.textContent).toContain(sentence)
    } finally {
      cleanup()
    }
  })
})
