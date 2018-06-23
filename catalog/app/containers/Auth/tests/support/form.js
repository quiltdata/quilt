import { step } from 'testing/feature';
import {
  mockComponentSelector,
  getPropName,
} from 'testing/util';

const defaultFieldSelector = (ctx, fieldName) =>
  ctx.mounted.find(`form [name="${fieldName}"]`).last();

const defaultFieldIsEnabled = (field) => !field.prop('disabled');

const defaultFieldIsWaiting = (field) => field.prop('disabled');

const defaultFieldErrorSelector = (ctx, fieldName) => {
  ctx.mounted.update();
  const field = defaultFieldSelector(ctx, fieldName);
  const errorText = field.find(getPropName('errorText'));
  return errorText.length ? errorText.text() : undefined;
};

const defaultSubmitSelector = (ctx) =>
  ctx.mounted.find(mockComponentSelector('RaisedButton')).at(0);

const defaultSubmitIsEnabled = (btn) => !btn.prop('disabled');

const defaultSubmitIsWaiting = (btn) =>
  btn.prop('disabled')
  &&
  btn.find(`${getPropName('children')} ${mockComponentSelector('Spinner')}`).length === 1;

const defaultSubmit = (ctx) =>
  ctx.mounted.find('form').simulate('submit');

const defaultFormErrorSelector = (ctx) => {
  const error = ctx.mounted.render()
    .find(`${mockComponentSelector('TextField')} + p`);
  return error.length ? error.text() : undefined;
};

export default ({
  values, // map of values
  fields, // array of names
  onSubmit,
  submit = defaultSubmit,
  submitSelector = defaultSubmitSelector,
  submitIsEnabled = defaultSubmitIsEnabled,
  submitIsWaiting = defaultSubmitIsWaiting,
  fieldSelector = defaultFieldSelector,
  fieldIsEnabled = defaultFieldIsEnabled,
  fieldIsWaiting = defaultFieldIsWaiting,
  fieldErrorSelector = defaultFieldErrorSelector,
  formErrorSelector = defaultFormErrorSelector,
}) => {
  const isValid = (ctx) => {
    const hasFieldError = fields.some((fieldName) =>
      fieldErrorSelector(ctx, fieldName));

    const hasFormError = Boolean(formErrorSelector(ctx));

    return !hasFieldError && !hasFormError;
  };

  const states = {
    valid: (ctx) => {
      expect(isValid(ctx)).toBe(true);
      expect(submitIsEnabled(submitSelector(ctx))).toBe(true);
    },
    invalid: (ctx) => {
      expect(isValid(ctx)).toBe(false);
      expect(submitIsEnabled(submitSelector(ctx))).toBe(false);
    },
    interactive: (ctx) => {
      fields.forEach((fieldName) =>
        expect(fieldIsEnabled(fieldSelector(ctx, fieldName))).toBe(true));
    },
    waiting: (ctx) => {
      fields.forEach((fieldName) =>
        expect(fieldIsWaiting(fieldSelector(ctx, fieldName))).toBe(true));

      expect(submitIsWaiting(submitSelector(ctx))).toBe(true);
    },
  };

  return [
    step(/I (re-)?enter (.+) into (.+) field/, (ctx, re, valueName, fieldName) => {
      const field = fieldSelector(ctx, fieldName);
      if (!field.length) throw new Error(`field not found: '${fieldName}'`);
      if (!(valueName in values)) throw new Error(`value not found: '${valueName}'`);
      const value = values[valueName];
      field.simulate('focus');
      if (re) field.simulate('change', { target: { value: '' } });
      field.simulate('change', { target: { value } });
      field.simulate('blur');
    }),

    step(/I should see no error on (.+) field/, (ctx, fieldName) => {
      expect(fieldErrorSelector(ctx, fieldName)).toBeFalsy();
    }),

    step(/I should see error on (.+) field: "(.+)"/, (ctx, fieldName, errorText) => {
      expect(fieldErrorSelector(ctx, fieldName)).toMatch(errorText);
    }),

    step(/I submit the form/, (ctx) => {
      const newCtx = onSubmit ? onSubmit(ctx) || ctx : ctx;
      submit(newCtx);
      return newCtx;
    }),

    step(/I should see form error: "(.+)"/, (ctx, errorText) => {
      expect(formErrorSelector(ctx)).toMatch(errorText);
    }),

    step(/I should see no form error/, (ctx) => {
      expect(formErrorSelector(ctx)).toBeFalsy();
    }),

    step(/I should see the form in (.+) state/, (ctx, stateName) => {
      if (!(stateName in states)) throw new Error(`state not found: '${stateName}'`);
      states[stateName](ctx);
    }),
  ];
};
