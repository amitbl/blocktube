'use strict';

const has = Object.prototype.hasOwnProperty;
const unicodeBoundry = "[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:'\",\\.\\/<>\\?`~:]+";
const ports = {};
let initStorage = false;
let compiledStorage;
let storage = {
  filterData: {
    videoId: [],
    channelId: [],
    channelName: [],
    comment: [],
    title: [],
    vidLength: [null, null],
    javascript: "",
  },
  options: {
    trending: false,
    mixes: false,
    suggestions_only: false
  },
};

const utils = {
  compileRegex(entriesArr, type) {
    if (!(entriesArr instanceof Array)) {
      return undefined;
    }
    // empty dataset
    if (entriesArr.length === 1 && entriesArr[0] === '') return [];

    // skip empty and comments lines
    const filtered = [...new Set(entriesArr.filter(x => !(x === '' || x.startsWith('//'))))];

    return filtered.map((v) => {
      v = v.trim();

      // unique id
      if (['channelId', 'videoId'].includes(type)) {
        return [`^${v}$`, ''];
      }

      // raw regex
      const parts = /^\/(.*)\/(.*)$/.exec(v);
      if (parts !== null) {
        return [parts[1], parts[2]];
      }

      // regular keyword
      return ['(^|' + unicodeBoundry + ')(' +
        v.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&') +
        ')(' + unicodeBoundry + '|$)', 'i'];
    });
  },

  compileAll(data) {
    const sendData = { filterData: {}, options: data.options };

    // compile regex props
    ['title', 'channelName', 'channelId', 'videoId', 'comment'].forEach((p) => {
      const dataArr = this.compileRegex(data.filterData[p], p);
      if (dataArr) {
        sendData.filterData[p] = dataArr;
      }
    });

    sendData.filterData.vidLength = data.filterData.vidLength;
    sendData.filterData.javascript = data.filterData.javascript;

    return sendData;
  },

  sendFilters(port) {
    port.postMessage({ type: 'filtersData', data: { storage, compiledStorage } });
  },

  sendFiltersToAll() {
    Object.keys(ports).forEach((p) => {
      try {
        ports[p].postMessage({ type: 'filtersData', data: { storage, compiledStorage } });
      } catch (e) {
        console.error('Where are you my child?');
      }
    });
  }
};

chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener((port) => {
        const key = port.sender.contextId || port.sender.frameId;
        delete ports[key];
    });
    const key = port.sender.contextId || port.sender.frameId;
    ports[key] = port;
    if (initStorage) utils.sendFilters(port);
});

chrome.storage.local.get('storageData', (data) => {
  if (data !== undefined && Object.keys(data).length > 0) {
    storage = data.storageData;
    compiledStorage = utils.compileAll(data.storageData);
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (has.call(changes, 'storageData')) {
      storage = changes.storageData.newValue;
      compiledStorage = utils.compileAll(changes.storageData.newValue);
      utils.sendFiltersToAll();
    }
  });

  initStorage = true;
  utils.sendFiltersToAll();
});

// TODO: Popup UI
chrome.browserAction.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
