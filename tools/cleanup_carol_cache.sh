#!/bin/bash

set -euC

for dir in $(ls -1 /tmp | grep carol); do
  echo "Removing /tmp/$dir..."
  rm -rf /tmp/$dir
done
