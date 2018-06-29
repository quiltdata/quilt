import { Map } from 'immutable';

import validate, * as validators from './validators';

describe('utils/validators', () => {
  describe('validate', () => {
    it('should be memoized', () => {
      const f1 = () => {};
      const f2 = () => {};
      expect(validate(f1)).toBe(validate(f1));
      expect(validate(f1)).not.toBe(validate(f2));
    });

    describe('the created validator function', () => {
      const values = Map({ v1: 'test', v2: 'test2' });
      const props = { p: 'test' };
      let test;
      let validator;

      beforeEach(() => {
        test = jest.fn((v) => v === 'test');
        validator = validate('test', test);
      });

      it('should call the test function with the passed arguments when the value is truthy', () => {
        const value = 'test';
        validator(value, values, props);
        expect(test).toBeCalledWith(value, values, props);
      });

      it('should not call the test function when the value is falsy', () => {
        const value = null;
        validator(value, values, props);
        expect(test).not.toBeCalled();
      });

      it('should return undefined when the value is falsy', () => {
        expect(validator(null)).toBeUndefined();
      });

      it('should return the given error string when the value is truthy and the test fails', () => {
        expect(validator('not test')).toBe('test');
      });

      it('should return undefined when the value is truthy and the test succeeds', () => {
        expect(validator('test')).toBeUndefined();
      });
    });
  });

  describe('matches', () => {
    it('should create a function that tests for the RegExp match', () => {
      const re = /test/;
      const matcher = validators.matches(re);
      expect(matcher('test')).toBe(true);
      expect(matcher('toast')).toBe(false);
    });
  });

  describe('matchesField', () => {
    it('should create a function that tests if two fields have the same value', () => {
      const matchesPassword = validators.matchesField('password');
      expect(matchesPassword('test', Map({ password: null }))).toBe(true);
      expect(matchesPassword('test', Map({ password: 'test' }))).toBe(true);
      expect(matchesPassword('sup', Map({ password: 'test' }))).toBe(false);
    });
  });

  describe('required', () => {
    it('should return "required" if the value is falsy', () => {
      expect(validators.required('')).toBe('required');
      expect(validators.required(null)).toBe('required');
      expect(validators.required(false)).toBe('required');
    });

    it('should return undefined if the value is truthy', () => {
      expect(validators.required(1)).toBeUndefined();
      expect(validators.required('test')).toBeUndefined();
      expect(validators.required(true)).toBeUndefined();
    });
  });
});
