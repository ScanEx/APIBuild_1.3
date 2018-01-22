#!/usr/bin/env bash

git submodule sync
git submodule update --init --recursive

### need install global `npm i -g jake` and `npm i -g gulp`
npm i
