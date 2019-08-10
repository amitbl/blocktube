(function () {
  const has = Object.prototype.hasOwnProperty;

  let isLoggedIn = false;
  let storageData = {
    filterData: {},
    options: {},
    uiPass: '',
  };

  function loadData() {
    chrome.storage.local.get('storageData', (data) => {
      if (Object.keys(data).length > 0) {
        storageData = data.storageData;
      }
      checkForLogin();
    });
  }

  function saveData(label = undefined) {
    if (!isLoggedIn) return;
    chrome.storage.local.set({ storageData }, () => {
      if (label !== undefined) setLabel(label, 'Options Saved');
    });
  }

  function saveForm() {
    ['title', 'channelName', 'channelId', 'videoId', 'comment'].forEach((v) => {
      storageData.filterData[v] = multilineToArray($(v).value);
    });

    const vidLenMin = parseInt($('vidLength_0').value, 10);
    const vidLenMax = parseInt($('vidLength_1').value, 10);
    storageData.filterData.vidLength   = [vidLenMin, vidLenMax];

    storageData.uiPass = $('pass_save').value;
    storageData.options.trending = $('disable_trending').checked;
    storageData.options.mixes = $('disable_mixes').checked;
    storageData.options.autoplay = $('autoplay').checked;
    storageData.options.suggestions_only = $('suggestions_only').checked;
    storageData.options.block_message = $('block_message').value;

    saveData('status_save');
  }

  function loginForm() {
    const savedPass = storageData.uiPass;
    if (savedPass && savedPass === $('pass_login').value) {
      unlockPage();
      isLoggedIn = true;
    } else {
      setLabel('status_login', 'Incorrect Password');
    }
  }

  function unlockPage() {
    populateForms();
    $('options').setAttribute('style', '');
    $('login').setAttribute('style', 'display: none');
  }

  function checkForLogin() {
    if (has.call(storageData, 'uiPass') && storageData.uiPass !== '') {
      $('login').setAttribute('style', '');
    } else {
      isLoggedIn = true;
      unlockPage();
    }
  }

  function populateForms(obj = undefined) {
    ['title', 'channelName', 'channelId', 'videoId', 'comment'].forEach((v) => {
      const content = get(`filterData.${v}`, [], obj);
      $(v).value = content.join('\n');
      const len = content.length + 5;
      $(v).rows = len < 40 ? len : 40;
    });

    const vidLength = get('filterData.vidLength', [NaN, NaN], obj);
    $('vidLength_0').value        = vidLength[0];
    $('vidLength_1').value        = vidLength[1];

    $('pass_save').value          = get('uiPass', '', obj);
    $('disable_trending').checked = get('options.trending', false, obj);
    $('disable_mixes').checked    = get('options.mixes', false, obj);
    $('autoplay').checked         = get('options.autoplay', false, obj);
    $('suggestions_only').checked = get('options.suggestions_only', false, obj);
    $('block_message').value      = get('options.block_message', '', obj);
  }

  // !! Helpers
  function $(id) {
    return document.getElementById(id);
  }

  function multilineToArray(text) {
    return text.replace(/\r\n/g, '\n').split('\n').map(x => x.trim());
  }

  function get(path, def = undefined, obj = undefined) {
    const paths = (path instanceof Array) ? path : path.split('.');
    let nextObj = obj || storageData;

    const exist = paths.every((v) => {
      if (nextObj instanceof Array) {
        const found = nextObj.find(o => has.call(o, v));
        if (found === undefined) return false;
        nextObj = found[v];
      } else {
        if (!nextObj || !has.call(nextObj, v)) return false;
        nextObj = nextObj[v];
      }
      return true;
    });

    return exist ? nextObj : def;
  }

  function setLabel(label, text) {
    const status = $(label);
    status.textContent = text;
    setTimeout(() => {
      status.textContent = '';
    }, 3000);
  }

  function saveFile(data, fileName) {
    const a = document.createElement('a');
    const blob = new Blob([JSON.stringify(data)], { type: 'octet/stream' });
    const url = URL.createObjectURL(blob);
    setTimeout(() => {
      a.href = url;
      a.download = fileName;
      const event = new MouseEvent('click');
      a.dispatchEvent(event);
    }, 0);
  }

  function importOptions(evt) {
    const files = evt.target.files;
    const f = files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
      let json;
      try {
        json = JSON.parse(e.target.result);
        if (json.filterData && json.options) {
          populateForms(json);
          saveForm();
        }
      } catch (ex) {
        alert('This is not a valid BlockTube backup');
      }
    };
    reader.readAsText(f);
  }

  // !! Start
  document.addEventListener('DOMContentLoaded', loadData);

  $('options').addEventListener('submit', (evt) => {
    evt.preventDefault();
    saveForm();
  });

  $('login').addEventListener('submit', (evt) => {
    evt.preventDefault();
    loginForm();
  });

  $('export').addEventListener('click', () => {
    if (isLoggedIn) {
      saveForm();
      saveFile(storageData, 'blocktube_backup.json');
    }
  });

  $('import').addEventListener('click', () => {
    if (isLoggedIn) {
      $('myfile').click();
    }
  });

  $('myfile').addEventListener('change', importOptions, false);
}());
