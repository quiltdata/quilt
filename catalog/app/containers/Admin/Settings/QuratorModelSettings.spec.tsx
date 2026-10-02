import * as React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

vi.mock('constants/config', () => ({ default: {} }))

const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
const OPUS = 'us.anthropic.claude-opus-4-5-20251101-v1:0'

const state = vi.hoisted(() => ({
  config: null as any,
  available: null as any,
  mutate: null as any,
}))

vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({
    admin: { quratorConfig: state.config, quratorAvailableModels: state.available },
  }),
  useMutation: () => state.mutate,
}))

import QuratorModelSettings, {
  combineIds,
  parseIds,
  splitSaved,
} from './QuratorModelSettings'

const config = (allowlist: string[] | null, dflt: string | null) => ({
  models: {
    allowlist,
    default: dflt,
    requestTimeoutSeconds: 120,
    maxToolCallsPerTurn: 20,
  },
  gateway: { endpointUrl: 'https://gw.example.net/bedrock', accountId: '123456789012' },
})

const ok = (input: any) => ({
  admin: {
    setQuratorConfig: {
      __typename: 'QuratorConfig',
      ...config(input.allowlist, input.default),
    },
  },
})

describe('containers/Admin/Settings/QuratorModelSettings', () => {
  beforeEach(() => {
    state.config = config(null, null)
    state.available = { models: null, unavailable: 'GATEWAY' }
    state.mutate = vi.fn(async ({ input }) => ok(input))
  })
  afterEach(cleanup)

  it('parses one id per line, dropping blanks and repeats', () => {
    expect(parseIds(` ${HAIKU}\n\n${OPUS}\n${HAIKU} `)).toEqual([HAIKU, OPUS])
  })

  it('writes the set with a member default, and the gateway and limits back unchanged', async () => {
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText('Allowed model IDs'), {
      target: { value: `${HAIKU}\n${OPUS}` },
    })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(state.mutate).toHaveBeenCalled())
    expect(state.mutate.mock.calls[0][0].input).toEqual({
      allowlist: [HAIKU, OPUS],
      default: HAIKU,
      gatewayEndpointUrl: 'https://gw.example.net/bedrock',
      gatewayAccountId: '123456789012',
      requestTimeoutSeconds: 120,
      maxToolCallsPerTurn: 20,
    })
  })

  it('unsets the governance when the list is emptied', async () => {
    state.config = config([HAIKU], HAIKU)
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText('Allowed model IDs'), { target: { value: '' } })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(state.mutate).toHaveBeenCalled())
    const { input } = state.mutate.mock.calls[0][0]
    expect(input.allowlist).toBeNull()
    expect(input.default).toBeNull()
  })

  it('shows the registry refusal', async () => {
    state.mutate = vi.fn(async () => ({
      admin: {
        setQuratorConfig: {
          __typename: 'InvalidInput',
          errors: [
            { path: 'allowlist', message: 'That value is not one this field accepts.' },
          ],
        },
      },
    }))
    const { getByLabelText, getByText, findByRole } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText('Allowed model IDs'), { target: { value: 'claude' } })
    fireEvent.click(getByText('Save'))
    expect((await findByRole('alert')).textContent).toBe(
      'That value is not one this field accepts.',
    )
  })

  it('CONTROL: Save stays disabled until something changes', () => {
    state.config = config([HAIKU], HAIKU)
    const { getByText } = render(<QuratorModelSettings />)
    expect(getByText('Save').closest('button')?.disabled).toBe(true)
  })

  describe('with a listing', () => {
    const LISTED = {
      unavailable: null,
      models: [
        { id: HAIKU, name: 'Claude Haiku 4.5', provider: 'Anthropic' },
        { id: OPUS, name: 'Claude Opus 4.5', provider: 'Anthropic' },
      ],
    }
    const EXTRA = 'us.meta.llama4-maverick-17b-instruct-v1:0'

    it('splits a saved set into ticked models and extra ids', () => {
      expect(splitSaved([OPUS, EXTRA], [HAIKU, OPUS])).toEqual({
        checked: [OPUS],
        extra: [EXTRA],
      })
      expect(combineIds([OPUS, HAIKU], [HAIKU, OPUS], `${EXTRA}\n${HAIKU}`)).toEqual([
        HAIKU,
        OPUS,
        EXTRA,
      ])
    })

    it('ticks saved models and keeps the rest in the extra box', () => {
      state.available = LISTED
      state.config = config([OPUS, EXTRA], OPUS)
      const { getByLabelText, getByRole } = render(<QuratorModelSettings />)
      expect(
        (getByRole('checkbox', { name: /Claude Opus 4\.5/ }) as HTMLInputElement).checked,
      ).toBe(true)
      expect(
        (getByRole('checkbox', { name: /Claude Haiku 4\.5/ }) as HTMLInputElement)
          .checked,
      ).toBe(false)
      expect((getByLabelText('Additional model IDs') as HTMLTextAreaElement).value).toBe(
        EXTRA,
      )
    })

    it('saves ticked and typed ids in the existing format', async () => {
      state.available = LISTED
      const { getByLabelText, getByRole, getByText } = render(<QuratorModelSettings />)
      fireEvent.click(getByRole('checkbox', { name: /Claude Opus 4\.5/ }))
      fireEvent.change(getByLabelText('Additional model IDs'), {
        target: { value: EXTRA },
      })
      fireEvent.click(getByText('Save'))
      await waitFor(() => expect(state.mutate).toHaveBeenCalled())
      const { input } = state.mutate.mock.calls[0][0]
      expect(input.allowlist).toEqual([OPUS, EXTRA])
      expect(input.default).toBe(OPUS)
    })

    it('unsets when nothing is ticked or typed', async () => {
      state.available = LISTED
      state.config = config([OPUS], OPUS)
      const { getByRole, getByText } = render(<QuratorModelSettings />)
      fireEvent.click(getByRole('checkbox', { name: /Claude Opus 4\.5/ }))
      fireEvent.click(getByText('Save'))
      await waitFor(() => expect(state.mutate).toHaveBeenCalled())
      expect(state.mutate.mock.calls[0][0].input.allowlist).toBeNull()
    })
  })

  it('says why there is no checklist behind a gateway', () => {
    const { getByRole } = render(<QuratorModelSettings />)
    expect(getByRole('status').textContent).toMatch(/AI gateway/)
  })
})
