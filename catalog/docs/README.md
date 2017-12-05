# Documentation

## Table of Contents

- [General](general)
  - [**CLI Commands**](general/commands.md)
  - [Introduction ](general/introduction.md)
  - [Tool Configuration](general/files.md)
  - [Server Configurations](general/server-configs.md)
  - [Deployment](general/deployment.md) *(currently Heroku specific)*
  - [FAQ](general/faq.md)
  - [Gotchas](general/gotchas.md)
  - [Remove](general/remove.md)
  - [Extracting components](general/components.md)
- [Testing](testing)
  - [Unit Testing](testing/unit-testing.md)
  - [Component Testing](testing/component-testing.md)
  - [Remote Testing](testing/remote-testing.md)
- [CSS](css)
  - [`styled-components`](css/styled-components.md)
  - [sanitize.css](css/sanitize.md)
  - [Using Sass](css/sass.md)
- [JS](js)
  - [Redux](js/redux.md)
  - [ImmutableJS](js/immutablejs.md)
  - [reselect](js/reselect.md)
  - [redux-saga](js/redux-saga.md)
  - [i18n](js/i18n.md)
  - [routing](js/routing.md)

## Overview

### Quickstart

1. First, let's kick the tyres by launching the sample _Repospective_ app
   bundled with this project to demo some of its best features:

    ```Shell
    npm run setup && npm start
    ```

1. Open [localhost:3000](http://localhost:3000) to see it in action.

    - Add a Github username to see Redux and Redux Sagas in action: effortless
      async state updates and side effects are now yours :)
    - Edit the file at `./app/containers/HomePage/index.js` so that the text of
      the `<Button>` component reads "Features!!!"... Hot Module Reloading gives
      you a feedback loop with your UI so smooth it's almost conversational!
    - Click your (newly emphatic) Features button to see React Router in action...
      Now you can share a direct link to that content privately over your LAN or
      globally addressable to any device, anywhere. Not bad for a locally-running
      Single Page App.

1. Time to build your own app: run

    ```shell
    npm run clean
    ```

    ...and use the built-in generators to start your first feature.

### Development

Run `npm start` to see your app at `localhost:3000`

### Building & Deploying

1. Run `npm run build`, which will compile all the necessary files to the
`build` folder.

2. Upload the contents of the `build` folder to your web server's root folder.

### Structure

The [`app/`](../../../tree/master/app) directory contains your entire application code, including CSS,
JavaScript, HTML and tests.

The rest of the folders and files only exist to make your life easier, and
should not need to be touched.

*(If they do have to be changed, please [submit an issue](https://github.com/mxstbr/react-boilerplate/issues)!)*

### CSS

Utilising [tagged template literals](https://github.com/styled-components/styled-components/blob/master/docs/tagged-template-literals.md)
(a recent addition to JavaScript) and the [power of CSS](https://github.com/styled-components/styled-components/blob/master/docs/css-we-support.md),
`styled-components` allows you to write actual CSS code to style your components.
It also removes the mapping between components and styles – using components as a
low-level styling construct could not be easier!

See the [CSS documentation](./css/README.md) for more information.

### JS

We bundle all your clientside scripts and chunk them into several files using
code splitting where possible. We then automatically optimize your code when
building for production so you don't have to worry about that.

See the [JS documentation](./js/README.md) for more information about the
JavaScript side of things.

### SEO

We use [react-helmet](https://github.com/nfl/react-helmet) for managing document head tags. Examples on how to
write head tags can be found [here](https://github.com/nfl/react-helmet#examples).

### Testing

For a thorough explanation of the testing procedure, see the
[testing documentation](./testing/README.md)!

#### Browser testing

`npm run start:tunnel` makes your locally-running app globally available on the web
via a temporary URL: great for testing on different devices, client demos, etc!

#### Unit testing

Unit tests live in `test/` directories right next to the components being tested
and are run with `npm run test`.
