const has = Object.prototype.hasOwnProperty;

let storage;
let ports = [];

const unicodeBoundry = "[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:'\",\\.\\/<>\\?`~:]+";

function compileFilterData(entriesArr) {
  if (!(entriesArr instanceof Array)) {
    return entriesArr;
  }
  // empty dataset
  if (entriesArr.length === 1 && entriesArr[0] === '') return [];

  // skip empty and comments lines
  const filtered = entriesArr.filter(x => !(x === '' || x.startsWith('//')));

  return filtered.map((v) => {
    v = v.trim();

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
}

function compileAll(data) {
  const sendData = { filterData: {}, options: data.options };

  // precompile channelId
  data.filterData.channelId = data.filterData.channelId.map(c => `/^${c}$/`);

  // compile regex props
  ['title', 'channelName', 'channelId', 'comment'].forEach((p) => {
    const dataArr = compileFilterData(data.filterData[p]);
    if (dataArr.length > 0) {
      sendData.filterData[p] = dataArr;
    }
  });

  // compile vidLength
  if (data.filterData.vidLength[0] !== null || data.filterData.vidLength[1] !== null) {
    sendData.filterData.vidLength = data.filterData.vidLength;
  }

  return sendData;
}

chrome.storage.local.get('storageData', (data) => {
  if (data !== undefined && Object.keys(data).length !== 0) {
    storage = compileAll(data.storageData);
  }

  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener((port) => {
      ports = ports.filter(p => p.sender.tab.id !== port.sender.tab.id);
    });

    ports.push(port);
    port.postMessage({ data: storage });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (has.call(changes, 'storageData')) {
      storage = compileAll(changes.storageData.newValue);
      ports.forEach((p) => {
        try {
          p.postMessage({ data: storage });
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
