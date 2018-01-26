import React, { PropTypes as PT } from 'react';
import { shallow } from 'enzyme';

import Pagination from '../index';


describe('<Pagination />', () => {
  const itemsEmpty = [];
  const items1page = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
  ];
  const items2pages = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
    { id: 4 },
    { id: 5 },
    { id: 6 },
    { id: 7 },
    { id: 8 },
    { id: 9 },
    { id: 10 },
    { id: 11 },
    { id: 12 },
  ];
  // TODO: import PER_PAGE constant?
  const items2pagesP1 = items2pages.slice(0, 10);
  // const items2pagesP2 = items2pages.slice(10, 20);
  // const items2pagesChanged = [
    // { id: 2 },
    // { id: 3 },
    // { id: 4 },
    // { id: 5 },
    // { id: 6 },
    // { id: 7 },
    // { id: 8 },
    // { id: 9 },
    // { id: 10 },
    // { id: 11 },
    // { id: 12 },
  // ];

  const SimpleList = ({ items }) =>
    <list>{items.map(({ id }) => <item key={id}>{id}</item>)}</list>;

  SimpleList.propTypes = {
    items: PT.array.isRequired,
  };

  const render = (items, children = SimpleList) =>
    shallow(<Pagination items={items}>{children}</Pagination>)
      // dive into HoCs
      .dive().dive().dive();

  const controlsSel = 'FormattedMessage[id="app.components.Pagination.of"]';

  // TODO
  // const clickNext = (wrapper) =>
    // wrapper.find('[direction="right"]').simulate('click');
  // const clickPrev = (wrapper) =>
    // wrapper.find('[direction="left"]').simulate('click');

  describe('when there is 0 items', () => {
    it('should match the snapshot', () => {
      expect(render(itemsEmpty).render()).toMatchSnapshot();
    });

    it('should not show pagination controls', () => {
      expect(render(itemsEmpty).find(controlsSel)).toHaveLength(0);
    });

    it('should pass items to the children', () => {
      const children = jest.fn();
      render(itemsEmpty, children);
      expect(children).toBeCalledWith({ items: itemsEmpty });
    });
  });

  describe('when there are items for only one page', () => {
    it('should match the snapshot', () => {
      expect(render(items1page).render()).toMatchSnapshot();
    });

    it('should not show pagination controls', () => {
      expect(render(items1page).find(controlsSel)).toHaveLength(0);
    });

    it('should pass items to the children', () => {
      const children = jest.fn();
      render(items1page, children);
      expect(children).toBeCalledWith({ items: items1page });
    });
  });

  describe('when there are items for more than one page', () => {
    it('should match the snapshot', () => {
      expect(render(items2pages)).toMatchSnapshot();
    });

    it('should show pagination controls', () => {
      expect(render(items2pages).find(controlsSel)).toHaveLength(1);
    });

    it('should pass paginated items to the children', () => {
      const children = jest.fn();
      render(items2pages, children);
      expect(children).toBeCalledWith({ items: items2pagesP1 });
    });
  });

  // TODO
  // describe('when next button is clicked', () => {
    // describe('and there is next page', () => {
      // it('should go to the next page', () => {
      // });
    // });
    // describe('and there is no next page', () => {
    // });
  // });

  // describe('when back button is clicked', () => {
    // describe('and there is previous page', () => {
    // });
    // describe('and there is no previous page', () => {
    // });
  // });

  // describe('when the items prop gets changed', () => {
    // it('should reset the page number', () => {
    // });
  // });
});
