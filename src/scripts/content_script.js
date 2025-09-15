(function () {
  'use strict';
  
  let port;
  let globalStorage;
  let compiledStorage;
  let enabled;

  const utils = {
    sendStorage() {
      window.postMessage({
        from: 'BLOCKTUBE_CONTENT',
        type: 'storageData',
        data: enabled ? (compiledStorage || globalStorage) : undefined,
      }, document.location.origin);
    },
    sendReload(msg, duration) {
      window.postMessage({
        from: 'BLOCKTUBE_CONTENT',
        type: 'reloadRequired',
        data: {msg, duration}
      }, document.location.origin);
    }
  };

  const events = {
    contextBlock(data) {
      if (!data.info.id) return;

      const options = {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric"
      }
      let now = new Intl.DateTimeFormat(undefined, options).format(new Date())
      const entries = [`// Blocked by context menu (${data.info.text}) (${now})`];
      const id = Array.isArray(data.info.id) ? data.info.id : [data.info.id];
      entries.push(...id);
      entries.push('');
      port.postMessage({'type': 'contextBlock', 'data': {'type': data.type, 'entries': entries}})
    }
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
            enabled = msg.data.enabled;
            utils.sendStorage();
          }
          break;
        }
        case 'reloadRequired': {
          utils.sendReload();
          break;
        }
        default:
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      connectToPort();
      
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
      case 'ready': {
        utils.sendStorage();
      }
      default:
        break;
    }
  }, true);

}());
