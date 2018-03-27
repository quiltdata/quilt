/* Config - environment-specific parameters */
/* eslint-disable no-underscore-dangle */
const config = window.__CONFIG;
Object.freeze(config);

const mustHave = {
  alwaysRequiresAuth: 'boolean',
  api: 'string',
  userApi: 'string',
  // eslint-disable-next-line comma-dangle
  signOutUrl: 'string'
};

const mustHaveTeam = {
  // eslint-disable-next-line comma-dangle
  team: 'object'
};

const mustHaveInTeam = {
  // eslint-disable-next-line comma-dangle
  id: 'string'
};

const shouldHaveInTeam = {
  // eslint-disable-next-line comma-dangle
  name: 'string'
};

// TODO: use lodash/conformsTo
// test the config object
check(mustHave, window.__CONFIG);
if (window.__CONFIG.team) {
  check(mustHaveTeam, window.__CONFIG);
  check(mustHaveInTeam, window.__CONFIG.team);
  check(shouldHaveInTeam, window.__CONFIG.team, false);
}

function check(expected, actual, error = true) {
  Object.keys(expected).forEach((key) => {
    const expectedType = expected[key];
    const actualValue = actual[key];
    const actualType = typeof actualValue;
    if ((actualType !== expectedType) || (actualType === 'string' && actualValue.length < 1)) {
      const msg = `Unexpected config['${key}']: ${actualValue}`;
      if (error) {
        throw new Error(msg);
      }
      // eslint-disable-next-line no-console
      console.warn(msg, window.__CONFIG);
    }
  });
}
/* eslint-enable no-underscore-dangle */

export default config;
