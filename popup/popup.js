let storageDefault = {
  filterData: {
    videoId: [],
    channelId: [],
    channelName: [],
    comment: [],
    title: [],
    vidLength: [null, null],
    javascript: "",
    percentWatchedHide: null
  },
  options: {
    trending: false,
    mixes: false,
    shorts: false,
    movies: false,
    suggestions_only: false,
    autoplay: false,
    enable_javascript: false,
    block_message: "",
    block_feedback: false,
    disable_db_normalize: false,
    disable_you_there: false,
    apply_filter: true
  },
};

document.addEventListener('DOMContentLoaded', () => {
  console.log("BlockTube Popup DOM is ready");

  const checkbox = document.getElementById("blockTubeEnabled");

  // Restore the switch state from storage
  chrome.storage.local.get({storageData: storageDefault}, (data) => {
    let storage = data.storageData;
    checkbox.checked = !!storage.options.apply_filter;
    chrome.storage.local.set({storageData: storage});
  });

  // Listen for changes to the switch
  checkbox.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
      chrome.storage.local.get({storageData: storageDefault}, (data) => {
        let storage = data.storageData;
        storage.options.apply_filter = event.target.checked;
        chrome.storage.local.set({storageData: storage});
        chrome.tabs.reload(); // Reload page to apply the new state
      });
    }
  });

  // Open options page
  document.getElementById("options-button").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
});   