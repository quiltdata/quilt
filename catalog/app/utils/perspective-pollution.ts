import perspective from '@finos/perspective'
import perspective_viewer from '@finos/perspective-viewer'
import '@finos/perspective-viewer-datagrid'

// TODO: import it on user demand (for example, "Load Charts" click button)
import '@finos/perspective-viewer-d3fc'

// Perspective 3.x's default entries fetch their WASM by bare filename, which the
// bundler can't emit. Import the .wasm as emitted asset URLs (see the `*.wasm`
// rule in webpack.base.js + the `*.wasm` ambient module in app/@types) and hand
// them to the engine/viewer init hooks. This mirrors what the `*.inline.js`
// entries do internally, but keeps the WASM as separate fetched (streamed) files
// rather than ~7MB of base64 inlined into the JS bundle.
import SERVER_WASM from '@finos/perspective/dist/wasm/perspective-server.wasm'
import VIEWER_WASM from '@finos/perspective-viewer/dist/wasm/perspective-viewer.wasm'

// Forked "Material Light" / "Material Light Mono" themes (app/assets) restore the
// catalog's pre-3.x look and the light<->mono toggle. They predate 3.x but use the
// same CSS-variable vocabulary. icons.css + intl.css supply the column-type
// mask-icons and i18n label strings that pro.css inlines but the forks don't.
import '@finos/perspective-viewer/dist/css/icons.css'
import '@finos/perspective-viewer/dist/css/intl.css'
import 'assets/perspective-material.css'
import 'assets/perspective-material-mono.css'

// Perspective 3.x uses a SINGLE client-side wasm engine: the viewer wasm.
// perspective.worker() takes its Client class from the registered
// <perspective-viewer> element's __wasm_module__ (set by
// perspective_viewer.init_client below), so the data client and the viewer
// share one wasm/linear-memory. We must NOT call perspective.init_client():
// that would stand up a SECOND, independent perspective-js.wasm engine, and a
// Table minted there would be dereferenced inside the viewer wasm at
// viewer.load() -> "RuntimeError: memory access out of bounds". This matches
// the official @finos/perspective 3.8.0 esbuild/webpack examples (two inits:
// init_server + perspective_viewer.init_client; no perspective.init_client).
//
// Export the readiness promise so getClient()/perspective.worker() can await it
// before sampling the engine. worker() reads the client wasm SYNCHRONOUSLY at
// call time from customElements.get('perspective-viewer'); that element is only
// registered at the END of init_client's async chain (await J() ->
// customElements.define). Calling worker() before that resolves would leave the
// client wasm unresolved/foreign -> the same cross-engine OOB.
export const perspectiveReady = Promise.all([
  perspective.init_server(fetch(SERVER_WASM)),
  perspective_viewer.init_client(fetch(VIEWER_WASM)),
])

export const themes = ['Material Light', 'Material Light Mono']
