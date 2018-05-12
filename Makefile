.PHONY: build clean
DEST = dist

build:
	mkdir -p ${DEST}
	cp -R src                           ${DEST}/
	cp -R assets                        ${DEST}/
	cp LICENSE  		                    ${DEST}/
	cp manifest.json                    ${DEST}/
	zip ${DEST}/blocktube.zip -qr ${DEST}/*

clean:
	rm -rf ${DEST}
