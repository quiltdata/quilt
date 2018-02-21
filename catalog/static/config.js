/* eslint-disable */
if (window.location.hostname === 'quiltdata.com') {
  window.__CONFIG = {
    api: 'https://pkg.quiltdata.com',
    stripeKey: 'pk_live_aV44tCGHpBZr5FfFCUqbXqid',
    userApi: 'https://app.quiltdata.com/accounts/api-root',
    signOutUrl: 'https://app.quiltdata.com/accounts/logout?next=%2F'
  };
} else {
  window.__CONFIG = {
    api: window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://stage-registry.quiltdata.com',
    stripeKey: 'pk_test_DzvjoWzXwIB1DRtQqywxDjWp',

    // Quilt auth
    userApi: 'https://stage-auth.quiltdata.com/accounts/api-root',
    signOutUrl: 'https://stage-auth.quiltdata.com/accounts/logout?next=%2F',
    /* Dev config
    team: {
      name: "TEST"
    },
    userApi: 'http://localhost:5002/accounts/api-root',
    signOutUrl: 'http://localhost:5002/accounts/logout?next=%2F',
    */

    // GitHub
    // userApi: 'https://api.github.com/user',
    // signOutUrl: '/'
  };
}
