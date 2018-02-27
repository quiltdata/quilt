/* Config - environment-specific parameters */
/* eslint-disable no-underscore-dangle */
const config = window.__CONFIG; // eslint-disable-line no-underscore-dangle
Object.freeze(config);

const mustHave = {
  alwaysRequireAuth: 'boolean',
  api: 'string',
  stripeKey: 'string',
  userApi: 'string',
  // eslint-disable-next-line comma-dangle
  signOutUrl: 'string'
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

if (window.__CONFIG.team && !window.__CONFIG.team.id) {
  // eslint-disable-next-line no-console
  console.warning(`Unexpected: config.team set but missing team.id ${window.__CONFIG.team}`);
}
/* eslint-enable no-underscore-dangle */

export default config;
