The Quilt catalog has a special (limited) S3 browser that can be embedded into any web app using an iframe.
This embeddable browser is served off the main catalog server under `/__embed` route.

![](../imgs/embed-example.png)


## Usage

Here's an example code written in plain JavaScript + React outlining the basic use cases:

```js
import * as React from 'react'

const EMBED_ORIGIN = 'https://my-quilt-catalog'
const PARENT_ORIGIN = window.location.origin
const EVENT_SOURCE = 'quilt-embed'

const mkNonce = () => `${Math.random()}`.slice(2)

function Embed() {
  const iframeRef = React.useRef(null)

  const [nonce, setNonce] = React.useState(mkNonce)

  // nonce is used to identify "our" embed instance and make sure we're receiving messages from the same instance
  // origin must be sent as a query parameter to enable cross-origin message passing from embed to the parent
  const src = `${EMBED_ORIGIN}/__embed?nonce=${nonce}&origin=${encodeURIComponent(PARENT_ORIGIN)}`

  const postMessage = React.useCallback(
    // function for sending messages to the embed (it will only handle messages sent by the window that opened it aka parent)
    (msg) => {
      if (!iframeRef.current) return
      // origin must be sent as a second parameter to enable cross-origin message passing
      iframeRef.current.contentWindow.postMessage(msg, EMBED_ORIGIN)
    },
    [iframeRef],
  )

  const initialize = React.useCallback(() => {
    postMessage({
      type: 'init',
      bucket: 'your-bucket-here',
      path: 'path-to-object-or-prefix',
      // initial route embed will navigate to, takes precedence over bucket / path
      route: '/b/your-bucket/some/path',
      // embed accepts any credentials supported by the Quilt authentication endpoint,
      // e.g. { provider, token } for SSO or { password, username } (which doesn't seem like a right choice in most cases)
      // getting credentials is your app's responsibility
      credentials: { provider: 'okta', token: 'my token' },
      // embed can be "scoped" to a path, meaning that path will be a virtual "root" for the object browser,
      // but only for display purposes (i.e. formatting paths / rendering breadcrumbs),
      // it won't prevent navigating to the paths outside the scope if navigated directly
      // (via IPC or init parameters) or via a link, so it's not to be considered a security measure
      scope: 'some-path-to-scope-the-embed-to',
      // you can customize look and feel of the embed by providing theme overrides,
      // see [MUI theming reference](https://material-ui.com/customization/theming/)
      // and [Quilt theme construction code](https://github.com/quiltdata/quilt/blob/master/catalog/app/constants/style.js#L145)
      // for details
      theme: {
        palette: {
          primary: {
            main: '#282b50',
          },
          secondary: {
            main: '#339933',
          },
        },
        typography: {
          fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
        },
      },
      // some aspects of the UI can be overriden:
      overrides: {
        // this prop is responsible for customizing the display and behaviour of the "link" button
        // in the object revision list menu
        s3ObjectLink: {
          title: 'override title',
          // link [template](https://lodash.com/docs/4.17.15#template)
          // context:
          //   url: string -- url / route of the object version in the context of the embed
          //   s3HttpsUri: string -- HTTPS URI of the current object, e.g. https://my-bucket.s3.amazonaws.com/${key}?versionId=${version} (with properly encoded key)
          //   bucket: string -- current bucket
          //   key: string -- key of the browsed object
          //   version: string -- object version id
          href: 'https://my-app/s3-browser?route=<%= encodeURIComponent(url) %>',
          // notification shown after copying href to the clipboard (if `emit` is not set to "override")
          notification: 'url copied',
          // when set "notify" or "override", embed will send "s3ObjectLink" message
          // TODO: message reference
          // when set to "override", default action (copying href to clipboard) won't be performed
          emit: 'notify',
        },
      },
      // arbitrary CSS files can be injected to further customize look and feel and/or layout
      css: [
        'https://my-cdn.com/my-custom-styles-1.css',
        'https://my-other-host.com/my-custom-styles-2.css',
      ],
    })
  }, [postMessage])

  const navigate = React.useCallback((route) => {
    // you can command the embed to navigate to an arbitrary route
    postMessage({ type: 'navigate', route })
  }, [postMessage])

  const reloadIframe = React.useCallback(() => {
    // you can reload the iframe by generating a new nonce (and therefore changing `src` computed value)
    setNonce(mkNonce)
  }, [setNonce])

  const handleMessage = React.useCallback(
    (e) => {
      if (
        // ignore messages from other windows
        e.source !== iframeRef.current.contentWindow ||
        // ensure origin is what we expect it to be (user has not navigated away)
        e.origin !== EMBED_ORIGIN ||
        // ensure the message has expected format (.source set to 'quilt-embed')
        e.data.source !== EVENT_SOURCE ||
        // ensure this is "our" instance by comparing nonce passed to the iframe
        // via query string to the nonce passed back by the iframe
        nonce !== e.data.nonce
      )
        return
      // there are several types of messages coming from the embed:
      switch (e.data.type) {
        case 'error':
          return
        case 'ready':
          return
        case 'navigate':
          return
        case 's3ObjectLink':
          return
      }
    },
    [iframeRef, nonce],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  return (
    <iframe
      ref={iframeRef}
      src={src}
      width="900"
      height="600"
      // other things like styling and stuff
    />
  )
}
```


## API reference

### URL and query parameters

The embed is served off the main catalog server under `/__embed` route
which takes two optional query parameters:

`nonce`

`origin`


### Commands to embed

#### `init`

#### `navigate`

### Messages from embed

#### `ready`

#### `error`

#### `navigate`

#### `s3ObjectLink`


## Testing and debugging

Catalog also has `/__embed-debug` route which serves a simple debug interface for the embed:

![](../imgs/embed-debug.png)

It's useful for trying different parameters and inspecting messages passed to/from the embed.

Its main components are:

1. Inputs for `init` parameters and button for sending `init` command.

2. "Navigate to" button and route input for sending `navigate` command.

3. Embed window.

4. Message log.
