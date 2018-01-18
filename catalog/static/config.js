/* eslint-disable */
if (window.location.hostname === 'quiltdata.com') {
  window.__CONFIG = {
    api: 'https://pkg.quiltdata.com',
    stripeKey: 'pk_live_aV44tCGHpBZr5FfFCUqbXqid',
    userApi: 'https://app.quiltdata.com/api-root',
    signOutUrl: 'https://app.quiltdata.com/api-auth/logout?next=%2F'
  };
} else {
  window.__CONFIG = {
    api: 'https://pkg-stage.quiltdata.com',
    stripeKey: 'pk_test_DzvjoWzXwIB1DRtQqywxDjWp',

    // Quilt auth
    userApi: 'https://quilt-heroku.herokuapp.com/api-root',
    signOutUrl: 'https://quilt-heroku.herokuapp.com/api-auth/logout?next=%2F',
    team: {
      name: 'bnym'
    }
    // GitHub
    // userApi: 'https://api.github.com/user',
    // signOutUrl: '/'
  };
}
