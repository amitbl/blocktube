let enabled = true;

document.addEventListener('DOMContentLoaded', () => {

  function detectColorScheme() {

    chrome.storage.local.get("storageData", (result) => {
      let uiTheme = "light";
      let storageTheme = result.storageData?.uiTheme;

      if(storageTheme){
        uiTheme = storageTheme;
      } else if(!window.matchMedia) {
        uiTheme = "light";
      } else if(window.matchMedia("(prefers-color-scheme: dark)").matches) {
        uiTheme = "dark";
      }

      document.documentElement.setAttribute("data-theme", uiTheme);
    });
  }

  detectColorScheme();
  

  const checkbox = document.getElementById("toggle-extension");
  const statusText = document.getElementById("status-text");

  chrome.storage.onChanged.addListener((changes) => {
    if (Object.hasOwn(changes, 'enabled')) {
      enabled = !!changes.enabled.newValue;
      checkbox.checked = enabled;
      statusText.textContent = enabled ? "On" : "Off";
    }
  });

  // Restore the switch state from storage
  chrome.storage.local.get("enabled", (result) => {
    if (result.enabled === undefined) {
      result.enabled = true;
    }
    checkbox.checked = !!result.enabled;
    statusText.textContent = !!result.enabled ? "On" : "Off";
  });

  // Listen for changes to the switch
  checkbox.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
      console.log({enabled: !!event.target.checked})
        chrome.storage.local.set({enabled: !!event.target.checked});
        chrome.tabs.reload(); // Reload page to apply the new state
    }
  });

  // Open options page
  document.getElementById("options-button").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
});