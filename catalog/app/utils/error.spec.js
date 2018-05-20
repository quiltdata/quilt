import { BaseError } from 'utils/error';

describe('utils/error/BaseError', () => {
  describe('instance', () => {
    const e = new BaseError('test');

    it('should be ok', () => {
      expect(e).toEqual(expect.any(Error));
      expect(e).toEqual(expect.any(BaseError));
      expect(e.name).toBe('BaseError');
      expect(e.message).toBe('test');
      expect(e.stack).toEqual(expect.stringContaining(__filename));
      expect(e.stack).not.toEqual(expect.stringContaining('new BaseError'));
    });
  });

  describe('subclass without constructor', () => {
    class SpecificError extends BaseError {
      static displayName = 'SpecificError';
    }

    const e = new SpecificError('test');

    it('should be ok', () => {
      expect(e).toEqual(expect.any(Error));
      expect(e).toEqual(expect.any(BaseError));
      expect(e).toEqual(expect.any(SpecificError));
      expect(e.name).toBe('SpecificError');
      expect(e.message).toBe('test');
      expect(e.stack).toEqual(expect.stringContaining(__filename));
      expect(e.stack).not.toEqual(expect.stringContaining('new SpecificError'));
    });
  });

  describe('subclass with constructor', () => {
    class SpecificError extends BaseError {
      static displayName = 'SpecificError';

      constructor(data) {
        super('message');
        this.data = data;
      }
    }

    const e = new SpecificError('test');

    it('should be ok', () => {
      expect(e).toEqual(expect.any(Error));
      expect(e).toEqual(expect.any(BaseError));
      expect(e).toEqual(expect.any(SpecificError));
      expect(e.name).toBe('SpecificError');
      expect(e.message).toBe('message');
      expect(e.data).toBe('test');
      expect(e.stack).toEqual(expect.stringContaining(__filename));
      expect(e.stack).not.toEqual(expect.stringContaining('new SpecificError'));
    });
  });
});
