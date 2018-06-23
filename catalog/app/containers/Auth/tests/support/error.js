import { step } from 'testing/feature';
import { captureError } from 'utils/errorReporting';

// `jest.mock('utils/errorReporting')` should be called in the importing module
export default (errorCls = Error) => [
  step(/the error should be captured/, () => {
    expect(captureError).toBeCalledWith(expect.any(errorCls));
  }),
];
