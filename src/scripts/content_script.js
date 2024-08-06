(function () {
	'use strict';
	//	console.log('Content script is running.');

	let globalStorage;
	let compiledStorage;
	let ready = false;
	let port = null;

	const storage = {
		set(data) {
			chrome.storage.local.set({
				storageData: data
			});
		},
		get(cb) {
			chrome.storage.local.get('storageData', (storageRes) => {
				cb(storageRes.storageData);
			});
		},
	};

	const events = {
		contextBlock(data) {
			const entries = [`// Blocked by context menu (${data.info.text})`];
			const id = Array.isArray(data.info.id) ? data.info.id : [data.info.id];
			entries.push(...id);
			entries.push('');
			globalStorage.filterData[data.type].push(...entries);
			storage.set(globalStorage);
		},
		ready() {
			utils.sendStorage();
			ready = true;
		},
	};

	function connectToPort() {
		port = chrome.runtime.connect();

		// Listen for messages from background page
		port.onMessage.addListener((msg) => {
			switch (msg.type) {
				case 'filtersData': {
					if (msg.data) {
						globalStorage = msg.data.storage;
						compiledStorage = msg.data.compiledStorage;
					}
					if (ready) utils.sendStorage();
					break;
				}
				default:
					break;
			}
		});

		// Reload page on extension update/uninstall
		port.onDisconnect.addListener(() => {
			port = null;
			utils.sendReload();
		});
	}

	connectToPort();

	// Listen for messages from injected page script
	window.addEventListener('message', (event) => {
		if (event.source !== window) return;
		if (!event.data.from || event.data.from !== 'BLOCKTUBE_PAGE') return;

		switch (event.data.type) {
			case 'contextBlockData': {
				events.contextBlock(event.data.data);
				break;
			}
			default:
				break;
		}
	}, true);

	const utils = {
		sendStorage() {
			window.postMessage({
				from: 'BLOCKTUBE_CONTENT',
				type: 'storageData',
				data: compiledStorage || globalStorage,
			}, document.location.origin);
		},
		inject() {
			const injectScript = document.createElement('script');
			injectScript.src = chrome.runtime.getURL('src/scripts/inject.js');
			injectScript.onload = events.ready;
			injectScript.async = false;
			(document.head || document.documentElement).appendChild(injectScript);

			const seedScript = document.createElement('script');
			seedScript.src = chrome.runtime.getURL('src/scripts/seed.js'); // Use seed.js if needed
			seedScript.onload = events.ready;
			seedScript.async = false;
			(document.head || document.documentElement).appendChild(seedScript);
		},
		sendReload(msg, duration) {
			window.postMessage({
				from: 'BLOCKTUBE_CONTENT',
				type: 'reloadRequired',
				data: {
					msg,
					duration
				}
			}, document.location.origin);
		}
	};

	if (document.body) {
		utils.sendReload();
		return;
	}

	// Initialize script injection
	utils.inject();
}());
