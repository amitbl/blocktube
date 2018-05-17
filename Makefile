.PHONY: build clean
SHELL := /usr/bin/env bash
DEST = dist

build:
	mkdir -p ${DEST}
	cp -R src                           ${DEST}/
	cp -R assets                        ${DEST}/
	cp LICENSE                          ${DEST}/
	cp manifest.json                    ${DEST}/
	pushd ${DEST}/src/scripts; \
	uglifyjs --ecma 8 -o seed_.js seed.js; \
	sed -i -e "s/{SEED_CONTENTS}/$$(sed 's:[/\\&]:\\&:g' seed_.js)/" content_script.js; \
	rm -f seed*.js; \
	popd;
	zip ${DEST}/blocktube.zip -qr ${DEST}/*

clean:
	rm -rf ${DEST}
