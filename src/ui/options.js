(function () {
  const has = Object.prototype.hasOwnProperty;

  const defaultJSFunction = `(video, objectType) => {
  // Add custom conditions below

  // Custom conditions did not match, do not block
  return false;
}`;

  const jsEditors = {};
  let isLoggedIn = false;
  let storageData = {
    filterData: {
      javascript: defaultJSFunction,
    },
    options: {},
    uiPass: '',
  };

  const textAreas = ['title', 'channelName', 'channelId', 'videoId', 'comment'];

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
    textAreas.forEach((v) => {
      storageData.filterData[v] = multilineToArray(jsEditors[v].getValue());
    });

    const vidLenMin = parseInt($('vidLength_0').value, 10);
    const vidLenMax = parseInt($('vidLength_1').value, 10);

    storageData.filterData.vidLength   = [vidLenMin, vidLenMax];
    storageData.filterData.javascript  = jsEditors['javascript'].getValue();

    storageData.uiPass = $('pass_save').value;
    storageData.options.trending = $('disable_trending').checked;
    storageData.options.shorts = $('disable_shorts').checked;
    storageData.options.movies = $('disable_movies').checked;
    storageData.options.mixes = $('disable_mixes').checked;
    storageData.options.autoplay = $('autoplay').checked;
    storageData.options.suggestions_only = $('suggestions_only').checked;
    storageData.options.disable_db_normalize = $('disable_db_normalize').checked;
    storageData.options.disable_you_there = $('disable_you_there').checked;
    storageData.options.block_feedback = $('block_feedback').checked;
    storageData.options.enable_javascript = $('enable_javascript').checked;
    storageData.options.block_message = $('block_message').value;
    storageData.options.vidLength_type = $('vidLength_type').value;
    storageData.options.percent_watched_hide = parseInt($('percent_watched_hide').value, 10);

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
    textAreas.forEach((v) => {
      const content = get(`filterData.${v}`, [], obj);
      jsEditors[v].setValue(content.join('\n'));
    });

    const vidLength = get('filterData.vidLength', [NaN, NaN], obj);
    $('vidLength_0').value         = vidLength[0];
    $('vidLength_1').value         = vidLength[1];
    $('vidLength_type').value      = get('options.vidLength_type', 'allow', obj);

    $('pass_save').value           = get('uiPass', '', obj);
    $('disable_trending').checked  = get('options.trending', false, obj);
    $('disable_shorts').checked    = get('options.shorts', false, obj);
    $('disable_movies').checked    = get('options.movies', false, obj);
    $('disable_mixes').checked     = get('options.mixes', false, obj);
    $('autoplay').checked          = get('options.autoplay', false, obj);
    $('disable_db_normalize').checked = get('options.disable_db_normalize', false, obj);
    $('disable_you_there').checked   = get('options.disable_you_there', false, obj);
    $('suggestions_only').checked  = get('options.suggestions_only', false, obj);
    $('block_feedback').checked    = get('options.block_feedback', false, obj);
    $('enable_javascript').checked = get('options.enable_javascript', false, obj);
    $('block_message').value       = get('options.block_message', '', obj);
    $('percent_watched_hide').value = get('options.percent_watched_hide', NaN, obj);

    const jsContent = get('filterData.javascript', defaultJSFunction, obj);
    jsEditors['javascript'].setValue(jsContent);

    if ($('enable_javascript').checked) {
      $('advanced_tab').style.removeProperty("display");
    }

    setTimeout(_=>Object.values(jsEditors).forEach((v) => v.refresh()), 1); // https://stackoverflow.com/a/19970695
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

  function cmResizer(cm, resizer) {
    const MIN_HEIGHT = 70;

    function heightOf(element) {
      return parseInt(window.getComputedStyle(element).height.replace(/px$/, ""));
    }

    function onDrag(e) {
      cm.display.scroller.style.maxHeight = "100%";
      cm.setSize(null, Math.max(MIN_HEIGHT, (cm.start_h + e.y - cm.start_y)) + "px");
    }

    function onRelease(e) {
      document.body.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", onRelease);
    }

    resizer.addEventListener("mousedown", function (e) {
      cm.start_y = e.y;
      cm.start_h = heightOf(cm.display.wrapper);

      document.body.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", onRelease);
    });
  }

  textAreas.concat('javascript').forEach((v) => {
    jsEditors[v] = CodeMirror.fromTextArea($(v), {
      mode: v === 'javascript' ? 'javascript' : 'blocktube',
      matchBrackets: true,
      autoCloseBrackets: true,
      lineNumbers: true,
      styleActiveLine: true,
      lineWrapping: true,
      extraKeys: {
        F11: function(cm) {
          if (cm.getOption("fullScreen")) {
            cm.display.scroller.style.maxHeight = cm.start_h || "200px";
          } else {
            cm.display.scroller.style.maxHeight = "100%";
          }
          cm.setOption("fullScreen", !cm.getOption("fullScreen"));
        },
        Esc: function(cm) {
          if (cm.getOption("fullScreen")) {
            cm.display.scroller.style.maxHeight = cm.start_h || "200px";
            cm.setOption("fullScreen", false);
          }
        }
      }
    });
    cmResizer(jsEditors[v], $(v + '_resizer'));
  });

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

  $('enable_javascript').addEventListener('change', (v) => {
    if (v.target.checked) {
      $('advanced_tab').style.removeProperty("display");
      setTimeout(_ => jsEditors['javascript'].refresh(), 1);
    }
    else {
      $('advanced_tab').style.display = "none";
    }
  })
}());
