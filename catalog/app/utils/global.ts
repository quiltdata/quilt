const Global = {
  fetch: window?.fetch
    ? window.fetch.bind(window)
    : () =>
        Promise.resolve({
          headers: {},
          ok: false,
          redirected: false,
          status: 0,
          statusText: '',
          type: '',
          url: '',
        }),
}

export default Global
