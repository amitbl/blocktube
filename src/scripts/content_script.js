(function () {
  'use strict';

  // Do not run on already opened YouTube tabs
  if (document.body) {
    console.info('Please refresh this tab to activate BlockTube');
    return;
  }

  // Inject seed
  const seed = document.createElement('script');
  seed.textContent = '{SEED_CONTENTS}';
  seed.async = false;
  (document.head || document.documentElement).prepend(seed);

  let globalStorage;
  let compiledStorage;
  let ready = false;
  const port = chrome.runtime.connect();

  const storage = {
    set(data) {
      chrome.storage.local.set({ storageData: data });
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
      if (!(data.info.id instanceof Array)) {
        data.info.id = [data.info.id];
      }
      entries.push(...data.info.id);
      entries.push('');
      globalStorage.filterData[data.type].push(...entries);
      storage.set(globalStorage);
    },
    ready() {
      utils.sendStorage();
      ready = true;
    },
  };

  const utils = {
    sendStorage() {
      window.postMessage({
        from: 'BLOCKTUBE_CONTENT',
        type: 'storageData',
        data: compiledStorage || globalStorage,
      }, `https://${document.domain}`);
    },
    inject() {
      const s = document.createElement('script');
      s.src = chrome.extension.getURL('src/scripts/inject.js');
      s.onload = events.ready;
      s.async = false;
      (document.head || document.documentElement).appendChild(s);
    },
  };

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

  // Inject script to page
  utils.inject();
}());
