import * as React from 'react'
import { ThemeProvider } from '@material-ui/core/styles'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'

const { query, mutate } = vi.hoisted(() => ({
  query: { current: {} as any },
  mutate: vi.fn(),
}))

// `constants/config` reads window.QUILT_CATALOG_CONFIG at module load.
vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/GraphQL', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/GraphQL')>()),
  useQuery: () => query.current,
  useMutation: () => mutate,
}))

import EventWiring, { commands, currentWiring, Today } from './EventWiring'
import type { Wiring } from './EventWiring'

const wiring: Wiring = {
  __typename: 'EventBridgeWiring',
  ruleName: 'quilt-stk-1a2b3c4d',
  eventPattern: {
    source: ['aws.s3'],
    'detail-type': ['Object Created', 'Object Deleted'],
    detail: {
      bucket: { name: ['b'] },
      object: { key: [{ prefix: '.quilt/' }, { prefix: "it's/" }] },
    },
  },
  stackBusArn: 'arn:aws-us-gov:events:us-gov-east-1:111111111111:event-bus/quilt-stk',
  stackAccountId: '111111111111',
  stackRegion: 'us-gov-east-1',
  forwardingRoleArn:
    'arn:aws-us-gov:iam::111111111111:role/stk-S3NativeEventsForwardingRole',
  eventsLast24h: null,
}

const data = (w: Wiring | null, admitted: string[] = []) => ({
  data: {
    bucketConfig: { name: 'b', eventBridgeWiring: w },
    admin: { eventBridgeAccounts: { admitted } },
  },
  fetching: false,
})

const renderDialog = (snsNotificationArn: string | null = 'DO_NOT_SUBSCRIBE') =>
  render(
    <ThemeProvider theme={style.appTheme}>
      <EventWiring
        bucket="b"
        prefixes={['data/']}
        snsNotificationArn={snsNotificationArn}
        onClose={() => {}}
      />
    </ThemeProvider>,
  )

describe('containers/Admin/Buckets/EventWiring', () => {
  afterEach(() => {
    cleanup()
    mutate.mockReset()
  })

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
    expect(currentWiring('not-an-arn')).toEqual({ kind: 'unparsed', arn: 'not-an-arn' })
  })

  it('forwards a stack-account bucket through the stack role', () => {
    const c = commands('b', wiring, '111111111111', 'eu-west-1')
    expect(c.forwarder).toBeNull()
    expect(c.role).toBe(wiring.forwardingRoleArn)
    expect(c.rule).toContain(
      `--targets 'Id=quilt-stack-bus,Arn=${wiring.stackBusArn},RoleArn=${wiring.forwardingRoleArn}'`,
    )
    expect(c.enable).toContain(
      "--region 'eu-west-1' --bucket 'b' --output json > nc.json && \\",
    )
    expect(c.rule).toContain("aws events put-rule --region 'eu-west-1'")
    expect(c.rule).toContain("aws events put-targets --region 'eu-west-1'")
    expect(c.enable).toContain("jq -s '(.[0] // {}) + {EventBridgeConfiguration: {}}'")
  })

  it('creates a forwarding role in a data account and quotes the pattern for the shell', () => {
    const c = commands('b', wiring, '222222222222', 'eu-west-1')
    expect(c.role).toBe(
      'arn:aws-us-gov:iam::222222222222:role/quilt-eventbridge-forwarder',
    )
    expect(c.forwarder).toContain(`"Resource":"${wiring.stackBusArn}"`)
    expect(c.forwarder).toContain(
      "--policy-name 'quilt-111111111111-us-gov-east-1-quilt-stk'",
    )
    expect(c.forwarder).not.toContain('&&')
    expect(c.rule).toContain(`"prefix":"it'\\''s/"`)
    expect(c.rule).toContain(`RoleArn=${c.role}`)
  })

  it('says an older stack has no wiring', () => {
    query.current = data(null)
    renderDialog()
    expect(screen.getByRole('dialog').textContent).toContain(
      'This stack doesn’t support EventBridge wiring yet',
    )
  })

  it('says a registry without the wiring fields has no wiring', () => {
    query.current = {
      fetching: false,
      error: new Error(
        '[GraphQL] Cannot query field "eventBridgeWiring" on type "BucketConfig".',
      ),
    }
    renderDialog()
    expect(screen.getByRole('dialog').textContent).toContain(
      'This stack doesn’t support EventBridge wiring yet',
    )
  })

  it('shows commands and the event count for the stack account', () => {
    query.current = data({ ...wiring, eventsLast24h: 1234 })
    renderDialog()
    const text = screen.getByRole('dialog').textContent
    expect(text).toContain('Events received (24h): 1234')
    expect(text).toContain('nothing to create')
    expect(text).toContain('live updates then cover only the scoped prefixes')
    expect(text).not.toContain('Admit account')
    expect(text).not.toContain('reach the stack twice')
  })

  it('warns that a subscribed bucket would receive its events twice', () => {
    query.current = data(wiring)
    renderDialog(null)
    expect(screen.getByRole('dialog').textContent).toContain('reach the stack twice')
  })

  it('removes an admitted account and shows a refusal', async () => {
    query.current = data(wiring, ['222222222222'])
    mutate.mockResolvedValue({
      admin: {
        eventBridgeAccountRemove: {
          __typename: 'OperationError',
          message: 'AccessDenied',
        },
      },
    })
    renderDialog()
    fireEvent.change(screen.getByLabelText('Bucket account ID'), {
      target: { value: '222222222222' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Remove'))
    })
    expect(mutate).toHaveBeenCalledWith({ accountId: '222222222222' })
    expect(screen.getByRole('alert').textContent).toContain('AccessDenied')
    expect(screen.getByText('Remove')).toBeTruthy()
  })

  it('admits a data account and then offers to remove it', async () => {
    query.current = data(wiring)
    mutate.mockResolvedValue({
      admin: {
        eventBridgeAccountAdmit: {
          __typename: 'EventBridgeAccountsSuccess',
          accounts: { admitted: ['222222222222'] },
        },
      },
    })
    renderDialog()
    expect(screen.getByRole('dialog').textContent).toContain(
      'Events received (24h): unknown',
    )
    fireEvent.change(screen.getByLabelText('Bucket account ID'), {
      target: { value: '1234' },
    })
    expect(screen.getByRole('dialog').textContent).toContain(
      'Enter a 12-digit AWS account ID',
    )
    fireEvent.change(screen.getByLabelText('Bucket account ID'), {
      target: { value: '222222222222' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Admit account'))
    })
    expect(mutate).toHaveBeenCalledWith({ accountId: '222222222222' })
    expect(screen.getByText('Remove')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain(
      'quilt-eventbridge-forwarder',
    )
  })

  it.each([
    [{ kind: 'skipped' } as const, 'without touching its notification targets'],
    [{ kind: 'unconfigured' } as const, 'removing its other targets'],
    [
      currentWiring('arn:aws:sns:us-east-1:123456789012:fanout'),
      'the registry didn’t create it',
    ],
  ])('describes %j', (w, sentence) => {
    const { container } = render(<Today wiring={w} />)
    expect(container.textContent).toContain(sentence)
  })
})
