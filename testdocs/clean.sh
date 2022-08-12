#!/usr/bin/env zsh

TEST_FILES=('data' 'notebooks' 'scripts' 'test_workflow' 'data.csv' 'example.jsonl' 'quilt_summarize.json' 'vega.json')
echo "Removing files and directories created by tests..."
for x in $TEST_FILES; do
  echo " - " $x
  rm -rf $x
done
