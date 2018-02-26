/* config.js */

/* eslint-disable no-underscore-dangle */
if (window.location.hostname === 'quiltdata.com') {
  window.__CONFIG = {
    api: 'https://pkg.quiltdata.com',
    stripeKey: 'pk_live_aV44tCGHpBZr5FfFCUqbXqid',
    userApi: 'https://app.quiltdata.com/accounts/api-root',
    signOutUrl: 'https://app.quiltdata.com/accounts/logout?next=%2F',
  };
} else {
  window.__CONFIG = {
    api: window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://stage-registry.quiltdata.com',
    stripeKey: 'pk_test_DzvjoWzXwIB1DRtQqywxDjWp',

    // Quilt auth
    // userApi: 'https://stage-auth.quiltdata.com/accounts/api-root',
    // signOutUrl: 'https://stage-auth.quiltdata.com/accounts/logout?next=%2F',

    // Team feature dev
    // team: {
    //   id: "SuperCorp",
    // },
    userApi: 'http://localhost:5002/accounts/api-root',
    signOutUrl: 'http://localhost:5002/accounts/logout?next=%2F',

    // GitHub
    // userApi: 'https://api.github.com/user',
    // signOutUrl: '/',
  };
}

const mustHave = {
  alwaysRequireAuth: 'boolean',
  api: 'string',
  stripeKey: 'string',
  userApi: 'string',
  signOutUrl: 'string',
};

// test the config object
const keys = Object.keys(window.__CONFIG);
// eslint has good reasons not to like for .. of, so do it the old-fashioned way:
for (let i = 0; i < keys.length; i += 1) {
  const k = keys[i];
  const v = window.__CONFIG[k];
  // eslint-disable-next-line valid-typeof
  if (k in mustHave && typeof v !== mustHave[k]) {
    throw new Error(`Unexpected config['${k}'}]: ${v}`);
  }
}

// if deployment script sets an empty team.id, there is no team
if (window.__CONFIG.team && !window.__CONFIG.team.id) {
  // eslint-disable-next-line no-console
  console.warning(`Empty team.id; unsetting 'config.team': ${window.__CONFIG.team}`);
  // blow away the object so JS can use `config.team` to detect team instances
  window.__CONFIG.team = undefined;
}
/* eslint-enable no-underscore-dangle */
