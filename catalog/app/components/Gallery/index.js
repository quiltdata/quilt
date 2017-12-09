/* Gallery of packages on Quilt */
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import styled from 'styled-components';

const feed = [
  {
    name: 'danWebster/sgRNAs',
    description: 'sgRNA designs that target the human genome, together with metadata about the sgRNA sequence and genomic location',
  },
  {
    name: 'vgauthier/DynamicPopEstimate',
    description: 'Dataset repository of the paper Estimation of Dynamic Urban Populations with Mobile Network Metadata',
  },
  {
    name: 'pearson/ece408',
    description: 'Holds the Fashion MNIST dataset for University of Illinois ECE408/CS483',
  },
  {
    name: 'uciml/iris',
    description: 'Benchmark machine learning data set.',
  },
  {
    name: 'cmungall/dinosaur_biotic_interactions',
    description: 'Here is a small data set of dinosaur biotic interactions documented by physical evidence in the fossil record, e.g., stomach contents, tooth marks.',
  },
  {
    name: 'ndarville/polls',
    description: 'Data on public support for political parties in Denmark',
  },
  {
    name: 'aktiur/elections_france',
    description: 'Résultats électoraux en France',
  },
  {
    name: 'akarve/seattle_911',
    description: 'Police responses to 9-1-1 calls within the city. Shows all officers dispatched. Refreshed on a 4 hour interval.',
  },
  {
    name: 'cdw/aics',
    description: 'Example cell feature dataset',
  },
  {
    name: 'uciml/abalone',
    description: 'Abalone data from the UCI machine learning repository',
  },
  {
    name: 'akarve/days',
    description: 'Table containing the seven days of the week, indexed by ISO-8601 integer code.',
  },
  {
    name: 'akarve/seattle_police',
    description: 'These incidents are based on initial police reports taken by officers when responding to incidents around the city.',
  },
  {
    name: 'akarve/cookbook_data',
    description: 'Data sets from Cyrille Rossant’s IPython Interactive Computing and Visualization Cookbook.',
  },
  {
    name: 'akarve/nyc_jobs',
    description: 'Current job postings from the City of New York’s jobs site. Internal postings available to city employees and external postings available to the general public are included.',
  },
];

function Gallery() {
  const cards = feed.map(({ name, description }) => (
    <Card key={name} href={`https://quiltdata.com/package/${name}`}>
      <h1>{name}</h1>
      <p>{description}</p>
    </Card>
  ));
  return (
    <div>
      <Row>
        <Col xs={12}>
          <Clip>
            {cards}
          </Clip>
        </Col>
      </Row>
    </div>
  );
}

Gallery.propTypes = {

};

const Card = styled.a`
  display: inline-block;
  vertical-align: top;
  white-space: normal;
  background-color: white;
  border: 1px solid #ddd;
  margin: 0em 1em 1em 0em;
  padding: 1em;
  width: 256px;
  height: 256px;

  &:hover, &:focus {
    background-color: #efefef;
  }

  &, &:visited, &:hover, &:focus {
    color: black;
    text-decoration: none; /* No underlines on the link */
  }

  h1 {
    font-size: 1em;
  }

  p {
    font-size: .8em;
    margin-top: 2em;
    opacity: 0.7;
  }
`;

const Clip = styled.div`
  overflow-x: auto;
  white-space: nowrap;
`;

export default Gallery;
