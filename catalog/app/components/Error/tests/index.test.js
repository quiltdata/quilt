import React from 'react';
import { mount } from 'enzyme';

import Error from '..';

jest.mock('react-bootstrap');

jest.mock('components/ImageRow');
jest.mock('constants/config');


describe('components/Error', () => {
  it('should render properly with default values', () => {
    const html = mount(<Error />).render();
    expect(html.find('h1').text()).toMatch('Something went wrong');
    expect(html.find('h2').text()).toMatch('Check network connection and login');
    expect(html.find('pre')).toHaveLength(0);
    expect(html).toMatchSnapshot();
  });

  it('should render properly with non-default values', () => {
    const obj = { a: { b: 2 } };
    const html = mount(
      <Error
        headline="Headline"
        detail="test"
        object={obj}
      />
    ).render();
    expect(html.find('h1').text()).toMatch('Headline');
    expect(html.find('h2').text()).toMatch('test');
    expect(html.find('pre').text()).toMatch('{\n  "a": {\n    "b": 2\n  }\n}');
    expect(html).toMatchSnapshot();
  });
});
