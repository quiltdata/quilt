/* Config - environment-specific parameters */
/* eslint-disable no-underscore-dangle */
const config = window.__CONFIG;
Object.freeze(config);

const mustHaveType = {
  alwaysRequireAuth: 'boolean',
  api: 'string',
  userApi: 'string',
  // eslint-disable-next-line comma-dangle
  signOutUrl: 'string'
};

// test the config object
Object.keys(mustHaveType).forEach((key) => {
  const expectedType = mustHaveType[key];
  const actualValue = window.__CONFIG[key];
  const actualType = typeof actualValue;
  if ((actualType !== expectedType) || (actualType === 'string' && actualValue.length < 1)) {
    throw new Error(`Unexpected config['${key}']: ${actualValue}`);
  }
});

if (window.__CONFIG.team && !window.__CONFIG.team.id) {
  // eslint-disable-next-line no-console
  console.warning(`Unexpected: config.team set but missing team.id ${window.__CONFIG.team}`);
}
/* eslint-enable no-underscore-dangle */

export default config;
