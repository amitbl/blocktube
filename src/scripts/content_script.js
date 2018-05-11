let globalStorage;
let compiledStorage;
let ready = false;
const port = chrome.runtime.connect();

const utils = {
  sendStorage() {
    window.postMessage({ from: 'BLOCKTUBE_CONTENT', type: 'storageData', data: compiledStorage || globalStorage }, `https://${document.domain}`);
  },
  inject() {
    const s = document.createElement('script');
    s.src = chrome.extension.getURL('src/scripts/inject.js');
    s.async = false;
    (document.head || document.documentElement).prepend(s);
  },
}

const storage = {
  set(data) {
    chrome.storage.local.set({ storageData: data });
  },
  get(cb) {
    chrome.storage.local.get('storageData', (storageRes) => {
      cb(storageRes.storageData);
    });
  }
}

const blockHandlers = {
  channelId(data) {
    return [
      `// Blocked by context menu (${data[0].text})`,
      data[0].navigationEndpoint.browseEndpoint.browseId,
      '',
    ];
  },
  videoId(data) {
    return [
      `// Blocked by context menu (${data.title.simpleText})`,
      data.videoId,
      '',
    ];
  }
};

const events = {
  contextBlock(data) {
    const entries = blockHandlers[data.type](data.info);
    globalStorage.filterData[data.type].push(...entries);
    storage.set(globalStorage);
  },
  ready() {
    if (compiledStorage) utils.sendStorage();
    ready = true;
  }
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
    case 'ready': {
      events.ready();
      break;
    }
  }
});

// Inject script to page
utils.inject();
