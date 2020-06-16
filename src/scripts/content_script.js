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
  let port = null;

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

  const utils = {
    sendStorage() {
      window.postMessage({
        from: 'BLOCKTUBE_CONTENT',
        type: 'storageData',
        data: compiledStorage || globalStorage,
      }, document.location.origin);
    },
    inject() {
      const s = document.createElement('script');
      s.src = chrome.extension.getURL('src/scripts/inject.js');
      s.onload = events.ready;
      s.async = false;
      (document.head || document.documentElement).appendChild(s);
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
      if (chrome.runtime.lastError) {
        console.log('Port error', chrome.runtime.lastError);
        connectToPort();
      } else {
        document.location.reload();
      }
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

  // Inject script to page
  utils.inject();
}());
