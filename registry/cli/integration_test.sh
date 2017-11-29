#!/bin/sh

set -e

echo WAITING FOR MIGRATION
sleep 10

quilt ls

echo BUILD $QUILT_USER/$PKG
quilt build $QUILT_USER/$PKG $PKG/build.yml
quilt ls

echo PUSH $QUILT_USER/$PKG
quilt push $QUILT_USER/$PKG

echo REMOVE quilt_packages/$QUILT_USER/$PKG.h5
rm quilt_packages/$QUILT_USER/$PKG.h5

echo INSTALL $QUILT_USER/$PKG
quilt install $QUILT_USER/$PKG
quilt ls
