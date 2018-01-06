/* eslint-disable */
const { hostname } = window.location;

if (hostname === 'quiltdata.com') {
  window.__CONFIG = {
    api: 'https://pkg.quiltdata.com',
    stripeKey: 'pk_live_aV44tCGHpBZr5FfFCUqbXqid',
    userApi: 'https://app.quiltdata.com/api-root',
    signOutUrl: 'https://app.quiltdata.com/api-auth/logout?next=%2F'
  };
} else if (hostname === 'packages-stage.firebaseapp.com' || hostname === 'localhost') {
  window.__CONFIG = {
    api: 'https://pkg-stage.quiltdata.com',
    stripeKey: 'pk_test_DzvjoWzXwIB1DRtQqywxDjWp',

    // Quilt auth
    userApi: 'https://quilt-heroku.herokuapp.com/api-root',
    signOutUrl: 'https://quilt-heroku.herokuapp.com/api-auth/logout?next=%2F'

    // GitHub
    // userApi: 'https://api.github.com/user',
    // signOutUrl: '/'
  };
} else {
  // TODO: This should come from Docker variables on team instances
  window.__CONFIG = {
    api: 'https://pkg-stage.quiltdata.com',
    stripeKey: 'pk_test_DzvjoWzXwIB1DRtQqywxDjWp',

    // Quilt auth
    userApi: 'https://quilt-heroku.herokuapp.com/api-root',
    signOutUrl: 'https://quilt-heroku.herokuapp.com/api-auth/logout?next=%2F',

    // GitHub
    // userApi: 'https://api.github.com/user',
    // signOutUrl: '/'
    team: {
      name: 'team_name'
    },
  };
}
