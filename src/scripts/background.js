'use strict';

const has = Object.prototype.hasOwnProperty;
const unicodeBoundry = "[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:'\",\\.\\/<>\\?`~:]+";
const ports = {};
let compiledStorage;
let storage = {
  filterData: {
    videoId: [],
    channelId: [],
    channelName: [],
    comment: [],
    title: [],
    vidLength: [null, null],
  },
  options: {
    trending: false,
    mixes: false,
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

    return sendData;
  },

  sendFilters(port) {
    port.postMessage({ type: 'filtersData', data: { storage, compiledStorage } });
  },
};

chrome.storage.local.get('storageData', (data) => {
  if (data !== undefined && Object.keys(data).length > 0) {
    storage = data.storageData;
    compiledStorage = utils.compileAll(data.storageData);
  }

  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener((port) => {
      delete ports[port.sender.tab.id];
    });
    ports[port.sender.tab.id] = port;
    utils.sendFilters(port);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (has.call(changes, 'storageData')) {
      storage = changes.storageData.newValue;
      compiledStorage = utils.compileAll(changes.storageData.newValue);
      Object.keys(ports).forEach((p) => {
        try {
          utils.sendFilters(ports[p]);
        } catch (e) {
          console.error('Where are you my child?');
        }
      });
    }
  });
});

// TODO: Popup UI
chrome.browserAction.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
