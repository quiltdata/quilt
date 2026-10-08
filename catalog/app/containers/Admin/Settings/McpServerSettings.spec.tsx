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
const push = vi.hoisted(() => vi.fn())
const captureException = vi.hoisted(() => vi.fn())
vi.mock('containers/Notifications', () => ({ use: () => ({ push }) }))
vi.mock('@sentry/react', () => ({ captureException }))
import * as style from 'constants/style'
import { McpSignInContext } from 'components/Assistant/Model/McpSignIn'

import McpServerSettings from './McpServerSettings'

// The endpoint styling reads the app-theme `typography.monospace` extension, so
// render under the theme the app provides rather than MUI's default.
const signInConnect = vi.fn()
const signInApi = {
  servers: [],
  pending: null,
  status: '',
  connect: signInConnect,
  disconnect: vi.fn(),
}
const mount = () =>
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <McpSignInContext.Provider value={signInApi}>
        <McpServerSettings />
      </McpSignInContext.Provider>
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
  oauthClientId: null,
  hasOauthClientSecret: false,
  oauthRedirectUri: 'https://registry.test/api/mcp/oauth/callback',
  signedInUsers: 0,
  ...overrides,
})

const setResult = (result: object) => ({ admin: { mcpServerSet: result } })

describe('containers/Admin/Settings/McpServerSettings', () => {
  describe('rendered', () => {
    afterEach(() => {
      cleanup()
      mutate.mockReset()
      signInConnect.mockReset()
      push.mockReset()
      captureException.mockReset()
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

    it('a failed save never hands the secret to Sentry', async () => {
      servers = [server()]
      const err = Object.assign(new Error('Network error'), {
        result: { operation: { variables: { input: { secret: 's3cret' } } } },
      })
      mutate.mockRejectedValue(err)
      const { getByText, getByLabelText } = mount()
      fireEvent.click(getByText('Edit'))
      fireEvent.change(getByLabelText('Secret'), { target: { value: 's3cret' } })
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      // The wrapper's own reporting, which attaches the result, is off.
      expect(mutate.mock.calls[0][1]).toEqual({ silent: true })
      expect(captureException).toHaveBeenCalledTimes(1)
      const [reported, ...rest] = captureException.mock.calls[0]
      expect(reported).not.toBe(err)
      expect(JSON.stringify([reported.message, rest])).not.toContain('s3cret')
    })

    it('an OAUTH server shows its redirect URI and keeps a stored client secret', async () => {
      servers = [
        server({
          auth: 'OAUTH',
          authHeader: null,
          hasSecret: false,
          oauthClientId: 'cid',
          hasOauthClientSecret: true,
          signedInUsers: 3,
        }),
      ]
      mutate.mockResolvedValue(setResult({ __typename: 'McpServerAdmin' }))
      const { getByText, getByLabelText } = mount()
      getByText('https://registry.test/api/mcp/oauth/callback')
      getByText(/3 users have so far/)
      fireEvent.click(getByText('Edit'))
      expect(getByLabelText('OAuth client secret').getAttribute('placeholder')).toBe(
        'stored',
      )
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      const { input } = mutate.mock.calls[0][0]
      expect(input).toMatchObject({ auth: 'OAUTH', secret: null })
      expect('oauthClientId' in input).toBe(false)
      expect(input.oauthClientSecret).toBeNull()
      expect(mutate.mock.calls[0][1]).toEqual({ silent: true })
    })

    it('a typed client secret is sent, and switching to OAUTH sends no header secret', async () => {
      servers = [server()]
      mutate.mockResolvedValue(setResult({ __typename: 'McpServerAdmin' }))
      const { getByText, getByLabelText } = mount()
      fireEvent.click(getByText('Edit'))
      fireEvent.change(getByLabelText('Authentication'), { target: { value: 'OAUTH' } })
      fireEvent.change(getByLabelText('OAuth client secret'), {
        target: { value: 'cs3cret' },
      })
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      const { input } = mutate.mock.calls[0][0]
      expect(input).toMatchObject({ auth: 'OAUTH', oauthClientSecret: 'cs3cret' })
      expect(input.secret).toBeNull()
      expect(input.authHeader).toBeNull()
    })

    it('an admin connects a disabled OAUTH server through the shared flow', async () => {
      servers = [server({ auth: 'OAUTH', enabled: false })]
      signInConnect.mockResolvedValue({ ok: true, message: 'Connected GPU cluster.' })
      const { getByText } = mount()
      await act(async () => {
        fireEvent.click(getByText('Connect'))
      })
      expect(signInConnect).toHaveBeenCalledWith('gpu', { title: 'GPU cluster' })
      expect(push).toHaveBeenCalledWith('Connected GPU cluster.')
    })

    it('leaving Settings before the sign-in ends drops its notice', async () => {
      servers = [server({ auth: 'OAUTH' })]
      let finish: (r: unknown) => void = () => {}
      signInConnect.mockReturnValue(new Promise((resolve) => (finish = resolve)))
      const { getByText, unmount } = mount()
      await act(async () => {
        fireEvent.click(getByText('Connect'))
      })
      unmount()
      await act(async () => finish({ ok: true, message: 'Connected GPU cluster.' }))
      expect(push).not.toHaveBeenCalled()
    })

    it('saving an OAUTH server with an unchanged client id omits it, keeping the stored one', async () => {
      servers = [server({ auth: 'OAUTH', authHeader: null, oauthClientId: 'cid' })]
      mutate.mockResolvedValue(setResult({ __typename: 'McpServerAdmin' }))
      const { getByText, getByLabelText } = mount()
      fireEvent.click(getByText('Edit'))
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect('oauthClientId' in mutate.mock.calls[0][0].input).toBe(false)
      fireEvent.click(getByText('Edit'))
      fireEvent.change(getByLabelText('OAuth client ID'), { target: { value: '' } })
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect(mutate.mock.calls[1][0].input.oauthClientId).toBeNull()
    })

    it('switching away from OAUTH does not send a client id', async () => {
      servers = [server({ auth: 'OAUTH', authHeader: null, oauthClientId: 'cid' })]
      mutate.mockResolvedValue(setResult({ __typename: 'McpServerAdmin' }))
      const { getByText, getByLabelText } = mount()
      fireEvent.click(getByText('Edit'))
      fireEvent.change(getByLabelText('Authentication'), { target: { value: 'NONE' } })
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect('oauthClientId' in mutate.mock.calls[0][0].input).toBe(false)
    })

    it('signing everyone out asks first', async () => {
      servers = [server({ auth: 'OAUTH', signedInUsers: 2 })]
      mutate.mockResolvedValue({ admin: { mcpServerSignOutAll: { __typename: 'Ok' } } })
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
      const { getByText } = mount()
      await act(async () => {
        fireEvent.click(getByText('Sign everyone out'))
      })
      expect(mutate).not.toHaveBeenCalled()
      confirm.mockReturnValueOnce(true)
      await act(async () => {
        fireEvent.click(getByText('Sign everyone out'))
      })
      expect(mutate.mock.calls[0][0]).toEqual({ slug: 'gpu' })
      expect(push).toHaveBeenCalledWith('Signed everyone out of GPU cluster.')
      confirm.mockRestore()
    })

    it('a conflicting save reloads the stored state and says why', async () => {
      servers = [server()]
      mutate.mockResolvedValue(
        setResult({ __typename: 'OperationError', name: 'Conflict', message: 'Stale.' }),
      )
      const { getByText } = mount()
      fireEvent.click(getByText('Edit'))
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect(push).toHaveBeenCalledWith(
        'GPU cluster was changed elsewhere; showing the stored version. Stale.',
      )
      expect(getByText('Edit')).toBeTruthy()
    })

    it('a toggle stored without its secret says the server stays disabled', async () => {
      servers = [server()]
      mutate.mockResolvedValue(
        setResult({
          __typename: 'OperationError',
          name: 'SavedWithoutSecret',
          message: 'saved',
        }),
      )
      const { getByLabelText } = mount()
      await act(async () => {
        fireEvent.click(getByLabelText('Enabled'))
      })
      expect(push).toHaveBeenCalledWith(
        'GPU cluster was saved but stays disabled until a secret is supplied.',
      )
    })

    it('a save stored without its secret refetches and says the server is disabled', async () => {
      servers = [server()]
      mutate.mockResolvedValue(
        setResult({
          __typename: 'OperationError',
          name: 'SavedWithoutSecret',
          message: 'saved; secret cleared',
        }),
      )
      const { getByText } = mount()
      fireEvent.click(getByText('Edit'))
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect(push).toHaveBeenCalledWith(
        'GPU cluster was saved but stays disabled until a secret is supplied.',
      )
      // Back to the list, which the refetch refreshes.
      expect(getByText('Edit')).toBeTruthy()
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
      expect(mutate).toHaveBeenCalledWith({ slug: 'gpu' }, { silent: true })
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
