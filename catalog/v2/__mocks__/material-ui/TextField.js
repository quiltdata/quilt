import { mockComponentClass } from 'testing/util';

export default mockComponentClass('TextField', {
  children: ['floatingLabelText', 'errorText'],
  methods: {
    getInputNode() { return null; },
  },
});
