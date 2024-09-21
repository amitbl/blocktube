#!/usr/bin/env bash

SCRIPT=`realpath $0`
BASEDIR=$(dirname $(dirname $SCRIPT))
VERSION="${2:-`cat $BASEDIR/VERSION`}"

copy_files() {
    mkdir -p $DEST
    cp -R $BASEDIR/src      $DEST
    cp -R $BASEDIR/assets   $DEST
    cp -R $BASEDIR/LICENSE  $DEST
    cp -R $BASEDIR/VERSION  $DEST
    cp platform/$BROWSER/manifest.json $DEST
}

set_version() {
    sed -i -e "s/{EXT_VERSION}/${VERSION}/" ${DEST}/manifest.json
    sed -i -e "s/{EXT_VERSION}/${VERSION}/" ${DEST}/src/ui/options.html
}

zipfile() {
    cd $DEST
    zip "$DEST/blocktube_${BROWSER}_v${VERSION}.zip" -qr ./*
}

clean() {
    rm -rf $DEST
}

build() {
    clean
    copy_files
    set_version
    zipfile
}

if [ "$1" == "firefox_selfhosted" ]; then
    DEST=$BASEDIR/dist/firefox_selfhosted
    BROWSER=firefox_selfhosted
    echo "Building Firefox Self-Hosted to $DEST"
    build
elif [ "$1" == "firefox" ]; then
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
