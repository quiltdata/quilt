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
import CLIENT_WASM from '@finos/perspective/dist/wasm/perspective-js.wasm'
import VIEWER_WASM from '@finos/perspective-viewer/dist/wasm/perspective-viewer.wasm'

import '@finos/perspective-viewer/dist/css/pro.css'
import '@finos/perspective-viewer/dist/css/pro-dark.css'

perspective.init_server(fetch(SERVER_WASM))
perspective.init_client(fetch(CLIENT_WASM))
perspective_viewer.init_client(fetch(VIEWER_WASM))

export const themes = ['Pro Light', 'Pro Dark']
