const port = chrome.runtime.connect();
let injected = false;

function sendStorage(data) {
  window.postMessage({ type: 'storageData', data }, `https://${document.domain}`);
}

function inject(data) {
  const s = document.createElement('script');
  s.src = chrome.extension.getURL('src/scripts/inject.js');
  s.onload = () => {
    sendStorage(data);
  };
  (document.head || document.documentElement).prepend(s);
  injected = true;
}

port.onMessage.addListener((msg) => {
  if (!injected) {
    inject(msg.data);
  } else {
    sendStorage(msg.data);
  }
});
