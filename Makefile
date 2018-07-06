.PHONY: build clean
SHELL := /usr/bin/env bash
DEST = dist
VERSION = 0.2.9

# npm install uglify-es
build:
	# copy files
	mkdir -p ${DEST}
	cp -R src                           ${DEST}/
	cp -R assets                        ${DEST}/
	cp LICENSE                          ${DEST}/
	cp manifest.json                    ${DEST}/

	# set version
	sed -i -e "s/{EXT_VERSION}/${VERSION}/" ${DEST}/manifest.json
	sed -i -e "s/{EXT_VERSION}/${VERSION}/" ${DEST}/src/ui/options.html

	# insert seed into content script
	pushd ${DEST}/src/scripts; \
	uglifyjs --ecma 8 -o seed_.js seed.js; \
	sed -i -e "s/{SEED_CONTENTS}/$$(sed 's:[/\\&]:\\&:g' seed_.js)/" content_script.js; \
	rm -f seed*.js;

	# zip it
	pushd ${DEST}; \
	zip ../blocktube.zip -qr ./*;

clean:
	rm -rf ${DEST}
	rm -f blocktube.zip
