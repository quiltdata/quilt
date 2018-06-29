import { step } from 'testing/feature';
import { captureError } from 'utils/errorReporting';

/**
 * Create a set of steps to test error capturing.
 * `jest.mock('utils/errorReporting')` should be called in the importing module.
 *
 * @param {object} errors Error class map.
 *
 * @returns {feature.step[]}
 */
export default (errors = {}) => [
  step(/the error should be captured/, () => {
    expect(captureError).toBeCalledWith(expect.any(errors.default || Error));
  }),

  step(/an? (.+) error should be captured/, (ctx, name) => {
    if (!(name in errors)) {
      throw new Error(`Error "${name}" not found in error map`);
    }
    expect(captureError).toBeCalledWith(expect.any(errors[name]));
  }),
];
