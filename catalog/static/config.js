/* config.js */
if (window.location.hostname === 'quiltdata.com') {
  // eslint-disable-next-line no-underscore-dangle
  window.__CONFIG = {
    alwaysRequireAuth: false,
    api: 'https://pkg.quiltdata.com',
    stripeKey: 'pk_live_aV44tCGHpBZr5FfFCUqbXqid',
    userApi: 'https://app.quiltdata.com/accounts/api-root',
    // eslint-disable-next-line comma-dangle
    signOutUrl: 'https://app.quiltdata.com/accounts/logout?next=%2F'
  };
} else {
  // eslint-disable-next-line no-underscore-dangle
  window.__CONFIG = {
    alwaysRequireAuth: false,
    api: window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://stage-registry.quiltdata.com',
    stripeKey: 'pk_test_DzvjoWzXwIB1DRtQqywxDjWp',

    // Quilt auth
    userApi: 'https://stage-auth.quiltdata.com/accounts/api-root',
    // eslint-disable-next-line comma-dangle
    signOutUrl: 'https://stage-auth.quiltdata.com/accounts/logout?next=%2F'

    // Team feature dev
    // team: {
    //   id: "SuperCorp",
    // },
    // userApi: 'http://auth:5002/accounts/api-root',
    // signOutUrl: 'http://auth:5002/accounts/logout?next=%2F',

    // GitHub
    // userApi: 'https://api.github.com/user',
    // signOutUrl: '/',
  };
}
