import { mount } from 'enzyme';
import React from 'react';

import Markdown from '..';


const render = (data, props) =>
  mount(<Markdown data={data} {...props} />).render();

const codeExpr = 'const v = 1';
const hlAuto =
`\`\`\`
${codeExpr}
\`\`\``;
const hlNone =
`\`\`\`none
${codeExpr}
\`\`\``;
const hlJS =
`\`\`\`javascript
${codeExpr}
\`\`\``;
const hlBad =
`\`\`\`javascrip
${codeExpr}
\`\`\``;

const imgs = [
  '![the image](http://test "the image title")',
  '![](http://test)',
];

const links = [
  '[sup](/url)',
  '[sup](/url "link title")',
];

describe('components/Markdown', () => {
  describe('syntax highlighting', () => {
    it('should highlight the recognized syntax properly', () => {
      const result = render(hlJS);
      expect(result.find('code.language-javascript')).toHaveLength(1);
      expect(result).toMatchSnapshot();
    });

    it('should not highlight if syntax set to "none"', () => {
      const result = render(hlNone);
      expect(result.find('code.language-none')).toHaveLength(1);
      expect(result.find('code.language-none').html()).toMatch(codeExpr);
      expect(result).toMatchSnapshot();
    });

    it('should auto-highlight when syntax is not specified or not recognized', () => {
      const resultAuto = render(hlAuto);
      const resultBad = render(hlBad);
      expect(resultAuto.find('code').html()).toBe(resultBad.find('code').html());
      expect(resultBad.find('code.language-javascrip')).toHaveLength(1);
      expect(resultAuto).toMatchSnapshot();
      expect(resultBad).toMatchSnapshot();
    });
  });

  describe('images', () => {
    it('should be rendered if enabled (default)', () => {
      const result = render(imgs[0]);
      const resultImg = result.find('img');
      expect(resultImg).toHaveLength(1);
      expect(resultImg.attr('src')).toBe('http://test');
      expect(resultImg.attr('alt')).toBe('the image');
      expect(resultImg.attr('title')).toBe('the image title');
      expect(result).toMatchSnapshot();
    });

    it('should not be rendered if disabled', () => {
      imgs.forEach((markup) => {
        const result = render(markup, { images: false });
        const resultSpan = result.find('span');
        expect(result.find('img')).toHaveLength(0);
        expect(resultSpan).toHaveLength(1);
        expect(resultSpan.text()).toBe(markup);
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('links', () => {
    it('should be rendered with rel="nofollow" attribute', () => {
      links.forEach((markup) => {
        const result = render(markup);
        const resultLink = result.find('a');
        expect(resultLink).toHaveLength(1);
        expect(resultLink.attr('rel')).toBe('nofollow');
        expect(result).toMatchSnapshot();
      });
    });
  });
});
