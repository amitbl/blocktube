#!/usr/bin/env bash

echo "Bulilding"

DES=dist
rm -f blocktube.zip
rm -rf $DES
mkdir -p $DES

cp -R src                           $DES/
cp -R assets                        $DES/
cp LICENSE.txt                      $DES/
cp manifest.json                    $DES/

pushd $DES/ > /dev/null
zip ../blocktube.zip -qr *
popd > /dev/null

echo "done"
