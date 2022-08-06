#!/usr/bin/env zsh

TEST_FILES=('data.csv' 'test_workflow'	'example.jsonl'	'vega.json')

for x in $TEST_FILES; do
  echo $x
  rm -rf $x
done
