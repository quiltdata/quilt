/* eslint-disable import/no-unresolved */
//   Wait till eslint will handle `exports` field
//   https://github.com/import-js/eslint-plugin-import/issues/1810
import '@finos/perspective-viewer'
import '@finos/perspective-viewer-datagrid'

// TODO: import it on user demand (for example, "Load Charts" click button)
import '@finos/perspective-viewer-d3fc'

import 'assets/perspective-material.css'
import 'assets/perspective-material-mono.css'

export const themes = ['Material Light', 'Material Light Mono']
