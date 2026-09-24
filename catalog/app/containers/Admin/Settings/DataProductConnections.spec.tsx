import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import * as M from '@material-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'
import type * as DP from 'model/DataProducts'
import * as fixtures from 'model/DataProducts/fixtures'

import DataProductConnections from './DataProductConnections'

// `useConnections` goes through ResourceCache, which needs a Provider this spec
// does not mount. Stub only that read, serving the same fixtures the fixture
// adapter resolves to, so the list assertions below still exercise real data.
vi.mock('model/DataProducts', async () => {
  const actual =
    await vi.importActual<typeof import('model/DataProducts')>('model/DataProducts')
  const fx = await vi.importActual<typeof import('model/DataProducts/fixtures')>(
    'model/DataProducts/fixtures',
  )
  return {
    ...actual,
    useConnections: () => connectionsForTest ?? fx.ALL_CONNECTIONS,
  }
})

// `null` means "serve the fixtures", which is what every list assertion below
// wants; a test that needs to prove the hook is the source sets it.
let connectionsForTest: DP.Connection[] | null = null

// The endpoint styling reads the app-theme `typography.monospace` extension, so
// render under the theme the app provides rather than MUI's default.
function mount() {
  return render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <DataProductConnections />
    </M.MuiThemeProvider>,
  )
}

afterEach(cleanup)
afterEach(() => {
  connectionsForTest = null
})

describe('containers/Admin/Settings/DataProductConnections', () => {
  describe('the connection list', () => {
    it('shows each configured catalog with where it points', () => {
      const { getByText } = mount()
      expect(getByText(/Clinical DataZone/)).toBeTruthy()
      expect(getByText('dzd_4xample')).toBeTruthy()
      expect(getByText('https://acme-prod.cloud.databricks.com')).toBeTruthy()
    })

    it('surfaces a failing connection with what the platform actually said', () => {
      // Paraphrasing a 401 into "connection failed" throws away the one detail
      // that tells an admin what to fix.
      const { getByText } = mount()
      expect(getByText('OAuth token exchange returned 401: invalid_client')).toBeTruthy()
    })

    it('says an unverified connection will not load products', () => {
      // The state most easily misread. Silence here would leave an admin
      // reading an empty product list as "this catalog has none" rather than
      // "nobody has checked this connection".
      const { getByText } = mount()
      expect(getByText(/Never verified/)).toBeTruthy()
    })

    it('never renders a credential, only that one is stored elsewhere', () => {
      // The secretRef fixtures are ARNs. If one reached the DOM it would mean the
      // component treats a pointer as displayable, and the next step from there is
      // treating a token the same way.
      const { container } = mount()
      expect(container.textContent).not.toContain('arn:aws:secretsmanager')
      expect(container.textContent).toContain('credential stored outside Quilt')
    })

    it('shows what each connector reaches and which way it may move products', () => {
      const { getByText } = mount()
      expect(getByText('DataZone · Subscribe only')).toBeTruthy()
      expect(getByText('Databricks · Publish and subscribe')).toBeTruthy()
      expect(getByText('Snowflake · Publish only')).toBeTruthy()
    })

    it('lists the local exchange, and that there is no stack-to-stack connector', () => {
      // The stack's own exchange has no endpoint and no credential, so it is not
      // a Connection. Omitting it would read as "sharing requires a vendor
      // catalog", and this is where the absence of a Quilt-to-Quilt connector is
      // visible rather than merely unbuilt.
      const { getByText } = mount()
      expect(getByText(/Local exchange/)).toBeTruthy()
      expect(getByText(/there is no stack-to-stack connector/)).toBeTruthy()
    })

    it('says these are connectors, not Connect', () => {
      // Two different things that both sound like "letting something outside in".
      const { getByText } = mount()
      // No `s` flag: the default normalizer already collapses the source's
      // newlines to spaces, and the flag needs an es2018 target this build
      // does not set.
      expect(getByText(/Connect.+is a different thing/)).toBeTruthy()
    })

    it('disables the check action, with the reason', () => {
      // No resolver exists. A live-looking Check button that did nothing would be
      // worse than a disabled one.
      const { getAllByText } = mount()
      const buttons = getAllByText('Check').map((el) => el.closest('button'))
      expect(buttons.length).toBeGreaterThan(0)
      expect(buttons.every((b) => b?.disabled)).toBe(true)
    })
  })

  // The list reports live integration status, including failures. Reading
  // `DP.fixtures` directly -- the one port bypass the review found -- would keep
  // showing three invented connections, one with a fabricated auth error, as the
  // operator's own after a real adapter lands.
  //
  // Asserted behaviourally: the mock above replaces only `useConnections`, so if
  // the component still read `fixtures` it would ignore this and render the
  // fixture rows regardless. Serving a single distinctive connection proves the
  // hook is the source.
  it('reads connections through the adapter port, not fixtures', () => {
    // Built from a real fixture so every field the row renders is present; only
    // the identifying text differs.
    connectionsForTest = [{ ...fixtures.ALL_CONNECTIONS[0], title: 'Only Via The Port' }]
    const { getByText, queryByText } = mount()
    expect(getByText(/Only Via The Port/)).toBeTruthy()
    // A fixture row that would appear if the component bypassed the hook.
    expect(queryByText(/Clinical DataZone/)).toBeNull()
  })

  describe('adding a catalog', () => {
    function openForm() {
      const utils = mount()
      fireEvent.click(utils.getByText('Add a catalog'))
      return utils
    }

    /**
     * Pick a select's option the way a user does: open it, click the option.
     *
     * Not `fireEvent.change` on the input — MUI v4 renders a hidden native input
     * the label is not associated with, so both `getByLabelText` and a synthetic
     * change on it miss the component's own state. Clicking the rendered option
     * exercises the real `onChange`.
     */
    function pick(utils: ReturnType<typeof mount>, testId: string, label: string) {
      // The testid sits on the InputBase wrapper (a plain div); the element that
      // opens the menu is the inner [role="button"], so query within the wrapper.
      const trigger = utils
        .getByTestId(testId)
        .querySelector('[role="button"]') as HTMLElement
      fireEvent.mouseDown(trigger)
      // Options render in a portal; scope to the listbox so the trigger's own
      // text (which shows the current selection) cannot match instead.
      const listbox = document.querySelector('[role="listbox"]') as HTMLElement
      fireEvent.click(
        Array.from(listbox.querySelectorAll('[role="option"]')).find(
          (o) => o.textContent === label,
        ) as HTMLElement,
      )
    }

    it('offers a browser sign-in only where the platform documents one', () => {
      // Databricks is the form's default and the only platform with a documented
      // U2M PKCE flow, so the sign-in button belongs here. `getAllByText` because
      // the tooltip wrapper duplicates the accessible text.
      const { getAllByText } = openForm()
      expect(getAllByText('Sign in with Databricks').length).toBeGreaterThan(0)
    })

    it('offers no OAuth button for DataZone, and says why', () => {
      // The load-bearing asymmetry. DataZone is SigV4 — there is no
      // authorization-code flow to offer, so a "Connect with OAuth" button would
      // be inventing a capability. The explanation is what stops an admin hunting
      // for a button that cannot exist.
      const utils = openForm()
      pick(utils, 'dpc-platform', 'AWS DataZone')
      expect(utils.queryByText('Sign in with Databricks')).toBeNull()
      expect(utils.getByText(/There is no OAuth flow to offer/)).toBeTruthy()
    })

    it('resets the auth method when the platform cannot honor it', () => {
      // Databricks + browser sign-in is the default; switching to DataZone must
      // not leave OAUTH_U2M selected, or an admin could submit a method the
      // platform does not support. DataZone's only method is an assumed role.
      const utils = openForm()
      pick(utils, 'dpc-platform', 'AWS DataZone')
      expect(utils.getByText(/A role ARN Quilt may assume/)).toBeTruthy()
    })

    it('asks for a credential reference, not a credential', () => {
      // Snowflake has no U2M option, so this is the pointer path. The helper text
      // is the contract: Quilt stores the reference and never the secret.
      const utils = openForm()
      pick(utils, 'dpc-platform', 'Snowflake')
      expect(utils.getByText(/Quilt stores the reference, never the secret/)).toBeTruthy()
    })

    it('derives the connector type from the catalog rather than asking twice', () => {
      // A second select the admin has to keep in sync with the first can only
      // ever disagree with it.
      const utils = openForm()
      expect(utils.getByText('Connector type: Databricks')).toBeTruthy()
      pick(utils, 'dpc-platform', 'Snowflake')
      expect(utils.getByText('Connector type: Snowflake')).toBeTruthy()
    })

    it('asks which way the connector may move products, separately', () => {
      // Access does not follow from the catalog, so unlike type it is asked.
      // Defaults to the reversible half.
      const utils = openForm()
      const access = utils.getByTestId('dpc-access')
      expect(access.textContent).toContain('Subscribe only')
      pick(utils, 'dpc-access', 'Publish and subscribe')
      expect(access.textContent).toContain('Publish and subscribe')
    })

    it('reserves the administrator field instead of guessing its grain', () => {
      // Omitting the field would read as "an exchange has no administrator".
      // Offering choices would decide the undecided grain by accident.
      const utils = openForm()
      expect(utils.getByText(/^Reserved\./)).toBeTruthy()
      const field = utils.getByPlaceholderText('Reserved') as HTMLInputElement
      // Read-only, not disabled: it must stay in the tab order for the helper
      // text to reach a keyboard reader.
      expect(field.readOnly).toBe(true)
      expect(field.disabled).toBe(false)
    })

    it('disables saving, with the reason', () => {
      const { getByText } = openForm()
      const save = getByText('Add connection').closest('button')
      expect(save?.disabled).toBe(true)
    })
  })
})
