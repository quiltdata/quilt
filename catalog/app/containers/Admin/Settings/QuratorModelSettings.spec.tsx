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

vi.mock('utils/GraphQL', async (importActual) => ({
  ...(await importActual<typeof import('utils/GraphQL')>()),
  useQueryS: () => ({ admin: { quratorConfig: state.config } }),
  useQuery: () =>
    state.available instanceof Error
      ? { fetching: false, error: state.available }
      : { fetching: false, data: { admin: { quratorAvailableModels: state.available } } },
  useMutation: () => state.mutate,
}))

import QuratorModelSettings, {
  combineIds,
  namesFor,
  parseIds,
  splitSaved,
} from './QuratorModelSettings'

const config = (
  allowlist: string[] | null,
  dflt: string | null,
  names: { id: string; name: string }[] | null = null,
) => ({
  models: {
    allowlist,
    default: dflt,
    requestTimeoutSeconds: 120,
    maxToolCallsPerTurn: 20,
    sessionRetentionDays: null as number | null,
    sessionMaxPerUser: null as number | null,
    names,
  },
  gateway: { endpointUrl: 'https://gw.example.net/bedrock', accountId: '123456789012' },
})

const ok = (input: any) => ({
  admin: {
    setQuratorConfig: {
      __typename: 'QuratorConfig',
      ...config(input.allowlist, input.default, input.names),
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

  it('keeps trimmed, non-blank display names for saved ids only', () => {
    expect(
      namesFor([HAIKU, OPUS], { [OPUS]: '  Big  ', [HAIKU]: '  ', gone: 'x' }),
    ).toEqual([{ id: OPUS, name: 'Big' }])
  })

  it('saves a display name typed next to a custom id', async () => {
    const ARN = 'arn:aws:sagemaker:us-east-1:123456789012:endpoint/nemotron-super'
    state.config = config([ARN], ARN)
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    const field = getByLabelText(`Display name for ${ARN}`) as HTMLInputElement
    // Unnamed, the field hints at what the menu shows instead.
    expect(field.placeholder).toBe('Nemotron Super')
    fireEvent.change(field, { target: { value: ' Nemotron (on-prem) ' } })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(state.mutate).toHaveBeenCalled())
    expect(state.mutate.mock.calls[0][0].input.names).toEqual([
      { id: ARN, name: 'Nemotron (on-prem)' },
    ])
    await waitFor(() => expect(field.value).toBe('Nemotron (on-prem)'))
  })

  it('reads no name for an id that matches a prototype key', () => {
    expect(namesFor(['constructor', 'toString'], {})).toEqual([])
  })

  it('shows a saved name on a listed model so it can be cleared', () => {
    state.config = config([HAIKU], HAIKU, [{ id: HAIKU, name: 'Quick' }])
    state.available = {
      models: [{ id: HAIKU, name: 'Claude Haiku 4.5' }],
      unavailable: null,
    }
    const { getByLabelText } = render(<QuratorModelSettings />)
    expect((getByLabelText(`Display name for ${HAIKU}`) as HTMLInputElement).value).toBe(
      'Quick',
    )
  })

  it('clears a saved name when its field is emptied', async () => {
    state.config = config([HAIKU], HAIKU, [{ id: HAIKU, name: 'Quick' }])
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText(`Display name for ${HAIKU}`), {
      target: { value: ' ' },
    })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(state.mutate).toHaveBeenCalled())
    expect(state.mutate.mock.calls[0][0].input.names).toBeNull()
  })

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
      names: null,
      sessionRetentionDays: null,
      sessionMaxPerUser: null,
    })
  })

  // The mutation replaces the whole row: an omitted 0 would turn saving back on.
  it('always sends the session limits, a saved 0 included', async () => {
    state.config = config([HAIKU], HAIKU)
    state.config.models.sessionRetentionDays = 0
    state.config.models.sessionMaxPerUser = 30
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText('Allowed model IDs'), {
      target: { value: `${HAIKU}\n${OPUS}` },
    })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(state.mutate).toHaveBeenCalled())
    const { input } = state.mutate.mock.calls[0][0]
    expect(input.sessionRetentionDays).toBe(0)
    expect(input.sessionMaxPerUser).toBe(30)
  })

  it('saves an edited retention', async () => {
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText('Keep for (days)'), { target: { value: '7' } })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(state.mutate).toHaveBeenCalled())
    expect(state.mutate.mock.calls[0][0].input.sessionRetentionDays).toBe(7)
  })

  it('refuses a limit that is not a whole number', () => {
    const { getByLabelText, getByText } = render(<QuratorModelSettings />)
    fireEvent.change(getByLabelText('Keep for (days)'), { target: { value: '1.5' } })
    expect(getByText('A whole number')).toBeTruthy()
    expect(getByText('Save').closest('button')?.disabled).toBe(true)
  })

  it('deletes every saved session only once confirmed', async () => {
    state.mutate = vi.fn(async () => ({ quratorSessionsPurgeAll: { __typename: 'Ok' } }))
    const { getByText, findByText } = render(<QuratorModelSettings />)
    fireEvent.click(getByText('Delete all saved sessions'))
    fireEvent.click(getByText('Cancel'))
    expect(state.mutate).not.toHaveBeenCalled()
    fireEvent.click(getByText('Delete all saved sessions'))
    fireEvent.click(getByText('Delete all'))
    expect(await findByText('All saved sessions were deleted.')).toBeTruthy()
    expect(state.mutate).toHaveBeenCalledTimes(1)
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
      // Ticked but no longer listed, after a refetch: kept.
      expect(combineIds([EXTRA], [HAIKU], '')).toEqual([EXTRA])
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

  describe('review cases', () => {
    const LISTED = {
      unavailable: null,
      models: [
        { id: HAIKU, name: 'Claude Haiku 4.5', provider: 'Anthropic' },
        { id: OPUS, name: 'Claude Opus 4.5', provider: 'Anthropic' },
      ],
    }

    it('leaves Save disabled when the saved order differs from the listing', () => {
      state.available = LISTED
      state.config = config([OPUS, HAIKU], OPUS)
      const { getByText } = render(<QuratorModelSettings />)
      expect(getByText('Save').closest('button')?.disabled).toBe(true)
    })

    it('says so when the account lists no models', () => {
      state.available = { unavailable: null, models: [] }
      const { getByRole } = render(<QuratorModelSettings />)
      expect(getByRole('status').textContent).toMatch(/No models were found/)
    })

    it('keeps the id box with the saved set when the listing fails outright', () => {
      state.available = new Error('Cannot query field "quratorAvailableModels"')
      state.config = config([OPUS], OPUS)
      const { getByLabelText, getByRole } = render(<QuratorModelSettings />)
      expect(getByRole('status').textContent).toMatch(/couldn't be listed/)
      expect((getByLabelText('Allowed model IDs') as HTMLTextAreaElement).value).toBe(
        OPUS,
      )
    })

    it('names a listed default in the dropdown', () => {
      state.available = LISTED
      state.config = config([OPUS], OPUS)
      const { getByLabelText } = render(<QuratorModelSettings />)
      expect(getByLabelText(/Default model/).textContent).toBe(`Claude Opus 4.5${OPUS}`)
    })
  })

  it('moves a ticked model the listing stops offering into the id box', () => {
    state.config = config([OPUS], OPUS)
    state.available = {
      unavailable: null,
      models: [
        { id: HAIKU, name: 'Claude Haiku 4.5', provider: 'Anthropic' },
        { id: OPUS, name: 'Claude Opus 4.5', provider: 'Anthropic' },
      ],
    }
    const { getByLabelText, rerender } = render(<QuratorModelSettings />)
    state.available = {
      unavailable: null,
      models: [{ id: HAIKU, name: 'Claude Haiku 4.5', provider: 'Anthropic' }],
    }
    rerender(<QuratorModelSettings />)
    expect((getByLabelText('Additional model IDs') as HTMLTextAreaElement).value).toBe(
      OPUS,
    )
  })
})
