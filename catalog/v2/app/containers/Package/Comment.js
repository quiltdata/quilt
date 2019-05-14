import Avatar from 'material-ui/Avatar';
import Divider from 'material-ui/Divider';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM, FormattedDate as FD } from 'react-intl';
import { Link } from 'react-router-dom';
import { setPropTypes } from 'recompose';
import styled from 'styled-components';

import MD from 'components/Markdown';
import Tag from 'components/Tag';
import { composeComponent } from 'utils/reactTools';

import msg from './messages';
import { getInitials } from './util';

const Container = styled.div`
  padding-top: 16px;
  padding-left: 56px;
  position: relative;
`;

const AvatarLink = styled(Link)`
  left: 0;
  position: absolute;
  top: 16px;

  &, &:hover, &:focus, &:active, &:visited {
    text-decoration: none;
  }
`;

const Heading = styled.div`
  display: flex;
  justify-content: space-between;
`;

const AuthorLink = styled(Link)`
  &, &:hover, &:focus, &:active, &:visited {
    color: inherit;
  }
`;

const CommentDate = styled.span`
  font-size: .75em;
  font-weight: 300;
  opacity: .5;
`;

export default composeComponent('Package.Comment',
  setPropTypes({
    author: PT.string.isRequired,
    created: PT.instanceOf(Date).isRequired,
    contents: PT.string.isRequired,
    isOwner: PT.bool,
  }),
  ({ author, created, contents, isOwner = false }) => (
    <Container>
      <AvatarLink to={`/package/${author}/`}>
        <Avatar>{getInitials(author)}</Avatar>
      </AvatarLink>
      <Heading>
        <span>
          <AuthorLink to={`/package/${author}/`}>{author}</AuthorLink>
          {isOwner && <Tag><FM {...msg.commentOwner} /></Tag>}
        </span>
        <CommentDate><FD value={created} /></CommentDate>
      </Heading>
      <MD images={false} data={contents} />
      <Divider />
    </Container>
  ));
