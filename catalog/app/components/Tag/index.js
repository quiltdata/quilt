import styled from 'styled-components';

export default styled.span`
  border-radius: 2px;
  border: 1px solid;
  font-size: 0.7em;
  opacity: 0.5;
  padding: 1px 4px;
  vertical-align: middle;

  * + & {
    margin-left: 0.5em;
  }
`;
