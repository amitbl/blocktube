#!/usr/bin/env bash

SCRIPT=`realpath $0`
BASEDIR=`dirname $SCRIPT`
VERSION=0.3.4

copy_files() {
    mkdir -p $DEST
    cp -R $BASEDIR/src      $DEST
    cp -R $BASEDIR/assets   $DEST
    cp -R $BASEDIR/LICENSE  $DEST
    cp platform/$BROWSER/manifest.json $DEST
}

set_version() {
    sed -i -e "s/{EXT_VERSION}/${VERSION}/" ${DEST}/manifest.json
    sed -i -e "s/{EXT_VERSION}/${VERSION}/" ${DEST}/src/ui/options.html
}

uglify() {
    pushd $DEST/src/scripts
    uglifyjs --ecma 8 -o seed_.js seed.js
    sed -i -e "s/{SEED_CONTENTS}/$(sed 's:[/\\&]:\\&:g' seed_.js)/" content_script.js
    rm -f seed*.js;
}

zipfile() {
    cd $DEST
    zip "$DEST/blocktube_$BROWSER_$VERSION.zip" -qr ./*
}

clean() {
    rm -rf $DEST
}

build() {
    clean
    copy_files
    set_version
    uglify
    zipfile
}

if [ "$1" == "firefox" ]; then
    DEST=$BASEDIR/dist/firefox
    BROWSER=firefox
    echo "Building Firefox to $DEST"
    build
elif [ "$1" == "chrome" ]; then
    DEST=$BASEDIR/dist/chrome
    BROWSER=chrome
    echo "Building Chrome to $DEST"
    build
else
    clean
fi

