/* Config - environment-specific parameters */
/* eslint-disable no-underscore-dangle */
const config = window.__CONFIG;
Object.freeze(config);

const mustHave = {
  alwaysRequireAuth: 'boolean',
  api: 'string',
  userApi: 'string',
  // eslint-disable-next-line comma-dangle
  signOutUrl: 'string'
};

const mustHaveTeam = {
  // eslint-disable-next-line comma-dangle
  team: 'object'
}

const mustHaveInTeam = {
  // eslint-disable-next-line comma-dangle
  id: 'string'
}

const shouldHaveInTeam = {
  // eslint-disable-next-line comma-dangle
  name: 'string'
}

// test the config object
Object.keys(mustHave).forEach(k => check(k, mustHave, window.__CONFIG));

if (window.__CONFIG.team) {
  Object.keys(mustHaveTeam).forEach(k => check(k, mustHaveTeam, window.__CONFIG));
  Object.keys(mustHaveInTeam).forEach(k => check(k, mustHaveInTeam, window.__CONFIG.team));
  Object.keys(shouldHaveInTeam).forEach(k => check(k, mustHaveInTeam, window.__CONFIG.team, false));
}

function check(key, expected, actual, error=true) {
  const expectedType = expected[key];
  const actualValue = actual[key];
  const actualType = typeof actualValue;
  if ((actualType !== expectedType) || (actualType === 'string' && actualValue.length < 1)) {
    const msg = `Unexpected config['${key}']: ${actualValue}`;
    if (error) {
      throw new Error(msg);
    }
    console.warn(msg, window.__CONFIG)
  }
}
/* eslint-enable no-underscore-dangle */

export default config;
