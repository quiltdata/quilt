import * as React from 'react'
import * as M from '@material-ui/core'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { registryUrl: 'https://registry.test' } }))

const mutate = vi.fn()
let servers: any[] = []
let available = true

vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({ run: vi.fn() }),
  useMutation: () => mutate,
  fold: (_q: unknown, handlers: any) =>
    handlers.data({ admin: { mcpServers: servers, mcpServersAvailable: available } }),
}))
vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import * as style from 'constants/style'

import McpServerSettings from './McpServerSettings'

// The endpoint styling reads the app-theme `typography.monospace` extension, so
// render under the theme the app provides rather than MUI's default.
const mount = () =>
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <McpServerSettings />
    </M.MuiThemeProvider>,
  )

const server = (overrides: Record<string, unknown> = {}) => ({
  slug: 'gpu',
  title: 'GPU cluster',
  url: 'https://mcp.internal.test/mcp',
  hint: null,
  enabled: false,
  trusted: false,
  auth: 'HEADER',
  authHeader: 'X-Api-Key',
  authPrefix: null,
  hasSecret: true,
  forwardIdentity: false,
  updatedAt: new Date(),
  ...overrides,
})

const setResult = (result: object) => ({ admin: { mcpServerSet: result } })

describe('containers/Admin/Settings/McpServerSettings', () => {
  describe('rendered', () => {
    afterEach(() => {
      cleanup()
      mutate.mockReset()
      servers = []
      available = true
    })

    it('flipping Trusted resends every field and leaves the stored secret alone', async () => {
      servers = [server()]
      mutate.mockResolvedValue(setResult({ __typename: 'McpServerAdmin' }))
      const { getByLabelText } = mount()
      await act(async () => {
        fireEvent.click(getByLabelText('Trusted'))
      })
      const { slug, input } = mutate.mock.calls[0][0]
      expect(slug).toBe('gpu')
      expect(input).toMatchObject({ trusted: true, authHeader: 'X-Api-Key' })
      expect(input.secret).toBeNull()
    })

    it('editing shows a stored secret as stored and sends none when left blank', async () => {
      servers = [server()]
      mutate.mockResolvedValue(setResult({ __typename: 'McpServerAdmin' }))
      const { getByText, getByLabelText } = mount()
      fireEvent.click(getByText('Edit'))
      expect(getByLabelText('Secret').getAttribute('placeholder')).toBe('stored')
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect(mutate.mock.calls[0][0].input.secret).toBeNull()

      fireEvent.click(getByText('Edit'))
      fireEvent.change(getByLabelText('Secret'), { target: { value: 's3cret' } })
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect(mutate.mock.calls[1][0].input.secret).toBe('s3cret')
    })

    it('Probe lists the tools with the flags the server declares', async () => {
      servers = [server()]
      mutate.mockResolvedValue({
        admin: {
          mcpServerProbe: {
            __typename: 'McpServerProbe',
            ok: true,
            failure: null,
            tools: [
              { name: 'job_status', readOnly: true, destructive: null, openWorld: null },
              { name: 'cancel_job', readOnly: false, destructive: true, openWorld: true },
            ],
          },
        },
      })
      const { getByText, getAllByText } = mount()
      await act(async () => {
        fireEvent.click(getByText('Probe'))
      })
      expect(mutate).toHaveBeenCalledWith({ slug: 'gpu' })
      expect(getByText('Connected, 2 tools')).toBeTruthy()
      expect(getByText('read-only')).toBeTruthy()
      expect(getByText('destructive')).toBeTruthy()
      expect(getAllByText('open-world')).toHaveLength(1)
    })

    it('says so when the stack has MCP servers switched off', () => {
      available = false
      const { getByText } = mount()
      expect(getByText(/switched off on this stack/)).toBeTruthy()
    })

    it('a refusal about the url lands on the url field, not in one opaque banner', async () => {
      mutate.mockResolvedValue(
        setResult({
          __typename: 'InvalidInput',
          errors: [{ path: 'url', name: 'invalid', message: 'Must be https' }],
        }),
      )
      const { getByText, getByLabelText } = mount()
      fireEvent.click(getByText('Register a server'))
      fireEvent.change(getByLabelText('Server endpoint URL'), {
        target: { value: 'http://insecure.test/mcp' },
      })
      await act(async () => {
        fireEvent.click(getByText('Register'))
      })
      const url = getByLabelText('Server endpoint URL') as HTMLInputElement
      const field = url.closest('.MuiFormControl-root')!
      expect(field.textContent).toContain('Must be https')
      expect(url.getAttribute('aria-invalid')).toBe('true')
    })
  })
})
