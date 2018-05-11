(function blockTube() {
  const has = Object.prototype.hasOwnProperty;

  // !! Globals

  // hooks already set in place?
  let init = false;

  // extension storageData
  let storageData;

  // TODO: hack for blocking data in other objects
  let currentBlock = false;

  const contextMenuObjects = ['videoRenderer', 'gridVideoRenderer', 'compactVideoRenderer'];

  // those properties can be safely deleted when one of thier child got filtered
  const deleteAllowed = [
    'content',
    'horizontalListRenderer',
    'verticalListRenderer',
    'shelfRenderer',
    'gridRenderer',
    'expandedShelfContentsRenderer',
    'comment',
    'commentThreadRenderer',
    'itemSectionRenderer',
  ];

  // need to filter following XHR requests
  const uris = [
    '/browse_ajax',
    '/related_ajax',
    '/list_ajax',
    '/guide_ajax',
  ];

  // those filter properties require RegExp checking
  const regexProps = [
    'channelId',
    'channelName',
    'title',
    'comment',
  ];

  // TODO: add rules descriptions
  // !! Filter Rules definitions
  const baseRules = {
    channelId: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
    channelName: ['shortBylineText.runs', 'shortBylineText.simpleText'],
    title: 'title.simpleText',
    vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text.simpleText',
  };

  const blockRules = {

    gridVideoRenderer: baseRules,
    videoRenderer: baseRules,
    radioRenderer: baseRules,
    channelRenderer: baseRules,
    playlistRenderer: baseRules,
    gridRadioRenderer: baseRules,
    compactVideoRenderer: baseRules,
    compactRadioRenderer: baseRules,
    playlistVideoRenderer: baseRules,
    endScreenVideoRenderer: baseRules,
    endScreenPlaylistRenderer: baseRules,
    gridPlaylistRenderer: baseRules,

    shelfRenderer: {
      channelId: 'endpoint.browseEndpoint.browseId',
    },

    channelVideoPlayerRenderer: {
      title: 'title.runs',
    },

    playlistPanelVideoRenderer: {
      properties: baseRules,
      customFunc: blockPlaylistVid,
    },

    videoPrimaryInfoRenderer: {
      properties: {
        title: 'title.simpleText',
      },
      customFunc: redirectToNext,
    },

    videoSecondaryInfoRenderer: {
      properties: {
        channelId: 'owner.videoOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
        channelName: 'owner.videoOwnerRenderer.title.runs',
      },
      customFunc: redirectToNext,
    },

    // channel page header
    c4TabbedHeaderRenderer: {
      properties: {
        channelId: 'channelId',
        channelName: 'title',
      },
      customFunc: redirectToIndex,
    },

    // related channels
    gridChannelRenderer: {
      channelId: 'channelId',
      channelName: 'title.simpleText',
    },

    miniChannelRenderer: {
      channelId: 'channelId',
      channelName: 'title.runs',
    },

    // sidemenu subscribed channels
    guideEntryRenderer: {
      channelId: 'navigationEndpoint.browseEndpoint.browseId',
      channelName: 'title',
    },

    universalWatchCardRenderer: {
      properties: {
        channelId: 'header.watchCardRichHeaderRenderer.titleNavigationEndpoint.browseEndpoint.browseId',
        channelName: 'header.watchCardRichHeaderRenderer.title.simpleText',
      },
    },
  };

  const ytPlayerRules = {

    args: {
      properties: {
        channelId: 'ucid',
        channelName: 'author',
        title: 'title',
        vidLength: 'length_seconds',
      },
    },

    videoDetails: {
      properties: {
        channelId: 'channelId',
        channelName: 'author',
        title: 'title',
        vidLength: 'lengthSeconds',
      },
      customFunc: disablePlayer,
    },
  };

  const guideRules = {

    // sidemenu subscribed channels
    guideEntryRenderer: {
      properties: {
        channelId: 'navigationEndpoint.browseEndpoint.browseId',
        channelName: 'title',
      },
    },
  };

  const commentsRules = {
    commentRenderer: {
      channelId: 'authorEndpoint.browseEndpoint.browseId',
      channelName: 'authorText.simpleText',
      comment: 'contentText.runs',
    },
    liveChatTextMessageRenderer: {
      channelId: 'authorExternalChannelId',
      channelName: 'authorName.simpleText',
      comment: 'message.runs',
    },
  };

  // !! ObjectFilter
  function ObjectFilter(object, filterRules, postActions = []) {
    if (!(this instanceof ObjectFilter)) return new ObjectFilter(object, filterRules, postActions);

    if (init === false || this.isDataEmpty()) return this;

    this.object = object;
    this.filterRules = filterRules;

    this.filter();
    postActions.forEach(x => x.call(this));
    return this;
  }

  ObjectFilter.prototype.isDataEmpty = function () {
    return Object.keys(storageData.filterData).length === 0
            && storageData.options.trending === false;
  };

  ObjectFilter.prototype.matchFilterData = function (filters, obj) {
    return Object.keys(filters).some((h) => {
      const filterPath = filters[h];
      if (filterPath === undefined) return false;

      const properties = storageData.filterData[h];
      if (properties === undefined) return false;

      const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
      let value;
      for (let idx = 0; idx < filterPathArr.length; idx += 1) {
        value = getObjectByPath(obj, filterPathArr[idx]);
        if (value !== undefined) break;
      }

      if (value === undefined) return false;

      if (value instanceof Array) {
        value = this.flattenRuns(value);
      }

      if (regexProps.includes(h) && properties.some(prop => prop && prop.test(value))) return true;
      else if (h === 'vidLength' && properties.length === 2) {
        const vidLen = parseTime(value);
        if ((vidLen > 0) &&
          (
            (properties[0] !== null && vidLen < properties[0]) ||
            (properties[1] !== null && vidLen > properties[1])
          )) {
          return true;
        }
      }
      return false;
    });
  };

  ObjectFilter.prototype.flattenRuns = function (arr) {
    return arr.reduce((res, v) => {
      if (has.call(v, 'text')) {
        res.push(v.text);
      }
      return res;
    }, []).join(' ');
  };

  ObjectFilter.prototype.matchFilterRule = function (obj) {
    return Object.keys(this.filterRules).reduce((res, h) => {
      let properties;
      let customFunc;
      const filteredObject = obj[h];

      if (filteredObject) {
        const filterRule = this.filterRules[h];
        if (has.call(filterRule, 'properties')) {
          properties = filterRule.properties;
          customFunc = filterRule.customFunc;
        } else {
          properties = filterRule;
          customFunc = undefined;
        }

        const isMatch = this.matchFilterData(properties, filteredObject);
        if (isMatch) {
          res.push({
            name: h,
            customFunc,
          });
        }
      }

      return res;
    }, []);
  };

  ObjectFilter.prototype.filter = function (obj = this.object) {
    let deletePrev = false;

    // we reached the end of the object
    if (typeof obj !== 'object' || obj === null) {
      return deletePrev;
    }

    let len = 0;
    let keys;

    // If object is an array len is the number of it's members
    if (obj instanceof Array) {
      len = obj.length;
      // otherwise, this is a plain object, len is number of keys
    } else {
      keys = Object.keys(obj);
      len = keys.length;
    }

    // object filtering
    const matchedRules = this.matchFilterRule(obj);
    matchedRules.forEach((r) => {
      let customRet = true;
      if (r.customFunc !== undefined) {
        customRet = r.customFunc.call(this, obj, r.name);
      }
      if (customRet === true) {
        delete obj[r.name];
        deletePrev = true;
      }
      return 0;
    });

    // loop backwards for easier splice
    for (let i = len - 1; i >= 0; i -= 1) {
      const idx = keys ? keys[i] : i;
      if (obj[idx] === undefined) continue;

      // filter next child
      // also if current object is an array, splice child
      const childDel = this.filter(obj[idx]);
      if (childDel && keys === undefined) {
        deletePrev = true;
        obj.splice(idx, 1);
      }

      // if next child is an empty array that we filtered, mark parent for removal.
      if (obj[idx] instanceof Array && obj[idx].length === 0 && childDel) {
        deletePrev = true;
      } else if (childDel && deleteAllowed.includes(idx)) {
        // special childs that needs removing if they're empty
        delete obj[idx];
        deletePrev = true;
      }
    }

    return deletePrev;
  };

  // !! Custom filtering functions

  function disablePlayer(ytData) {
    const message = (storageData.options.block_message) || 'Video Removed';

    ytData.playabilityStatus.status = 'ERROR';
    ytData.playabilityStatus.reason = '';
    ytData.playabilityStatus.errorScreen = {
      playerErrorMessageRenderer: {
        reason: {
          simpleText: message,
        },
        thumbnail: {
          thumbnails: [{
            url: '//s.ytimg.com/yts/img/meh7-vflGevej7.png',
            width: 140,
            height: 100,
          }],
        },
        icon: {
          iconType: 'ERROR_OUTLINE',
        },
      },
    };
  }

  function blockPlaylistVid(pl) {
    const vid = pl.playlistPanelVideoRenderer;
    const message = (storageData.options.block_message) || 'Video Removed';

    vid.videoId = 'undefined';

    vid.unplayableText = {
      simpleText: `[${message}]`,
    };

    vid.thumbnail = {
      thumbnails: [{
        url: 'https://s.ytimg.com/yts/img/meh_mini-vfl0Ugnu3.png',
      }],
    };

    delete vid.title;
    delete vid.longBylineText;
    delete vid.shortBylineText;
    delete vid.thumbnailOverlays;
  }

  function redirectToIndex() {
    this.object = undefined;
    document.location = '/';
  }

  function redirectToNext() {
    const twoColumn = getObjectByPath(this.object, 'contents.twoColumnWatchNextResults');
    if (twoColumn === undefined) return;

    const primary = getObjectByPath(twoColumn, 'results.results');
    if (primary === undefined) return;
    primary.contents = [];

    if (has.call(twoColumn, 'conversationBar')) delete twoColumn.conversationBar;

    const isPlaylist = new URL(document.location).searchParams.has('list');
    if (isPlaylist) return;

    const secondary = getObjectByPath(twoColumn, 'secondaryResults');
    if (storageData.options.autoplay !== true) {
      secondary.secondaryResults = undefined;
      return;
    }

    const nextVids = getObjectByPath(secondary, 'secondaryResults.results');
    if (nextVids === undefined) return;

    const prop = 'compactVideoRenderer';
    nextVids.some((vid) => {
      if (!has.call(vid, 'compactVideoRenderer')) return false;
      if (vid[prop] && vid[prop].videoId) document.location = `watch?v=${vid[prop].videoId}`;
      return true;
    });

    secondary.secondaryResults = undefined;
  }

  // !! Utils

  function getObjectByPath(obj, path, def = undefined) {
    const paths = (path instanceof Array) ? path : path.split('.');
    let nextObj = obj;

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

  function parseTime(timeStr) {
    const parts = String(timeStr).split(':').map(x => parseInt(x, 10));
    switch (parts.length) {
      case 3: {
        return (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2];
      }
      case 2: {
        return (parts[0] * 60) + parts[1];
      }
      case 1: {
        return parts[0];
      }
      default: {
        return -1;
      }
    }
  }

  function isUrlMatch(url) {
    if (!(url instanceof URL)) url = new URL(url);
    return uris.some(uri => uri === url.pathname) || url.searchParams.has('pbj');
  }

  function transformToRegExp(data) {
    if (!has.call(data, 'filterData')) return;

    regexProps.forEach((p) => {
      if (has.call(data.filterData, p)) {
        data.filterData[p] = data.filterData[p].map((v) => {
          try {
            return RegExp(v[0], v[1]);
          } catch (e) {
            console.error(`RegExp parsing error: /${v[0]}/${v[1]}`);
            return undefined;
          }
        });
      }
    });
  }

  function filterEmbed(real) {
    return function (val) {
      if (has.call(val, 'PLAYER_CONFIG')) ObjectFilter(val.PLAYER_CONFIG, ytPlayerRules);
      real(val);
    };
  }

  function filterXHR() {
    let url;
    let ytDataArr;

    try {
      url = new URL(this.responseURL);
    } catch (e) {
      if (this._orgCallback) this._orgCallback();
      return;
    }

    if (!isUrlMatch(url)) {
      if (this._orgCallback) this._orgCallback();
      return;
    }

    // only operate if we got the full response
    if (this.readyState !== 4) {
      return;
    }

    try {
      ytDataArr = JSON.parse(this.responseText);
    } catch (e) {
      console.error('Decoding JSON failed');
      if (this._orgCallback) this._orgCallback();
      return;
    }

    if (!(ytDataArr instanceof Array)) ytDataArr = [ytDataArr];

    ytDataArr.forEach((obj) => {
      if (has.call(obj, 'player')) {
        ObjectFilter(obj.player, ytPlayerRules);
      }

      if (has.call(obj, 'playerResponse')) {
        ObjectFilter(obj.playerResponse, ytPlayerRules);
      }

      if (has.call(obj, 'response')) {
        let rules;
        let postActions = [];
        switch (url.pathname) {
          case '/guide_ajax':
            rules = guideRules;
            break;
          case '/comment_service_ajax':
          case '/get_live_chat':
            rules = commentsRules;
            break;
          case '/watch':
            postActions = [removeRvs, fixAutoplay];
          default:
            rules = blockRules;
        }

        addContextMenus(obj.response);
        ObjectFilter(obj.response, rules, postActions);
      }
    }, this);

    // redefine responseText with filtered data
    Object.defineProperty(this, 'responseText', {
      writable: false,
      value: JSON.stringify(ytDataArr),
    });

    if (this._orgCallback) this._orgCallback();
  }

  function blockTrending() {
    if (document.location.pathname === '/feed/trending') {
      document.location = '/';
    }

    if (!has.call(storageData.filterData, 'channelId')) {
      storageData.filterData.channelId = [];
    }
    storageData.filterData.channelId.push(/^FEtrending$/);
  }

  function removeRvs() {
    if (has.call(this.object, 'webWatchNextResponseExtensionData')) {
      this.object.webWatchNextResponseExtensionData = undefined;
    }
  }

  function fixOverlay(index) {
    const overlays = getObjectByPath(
      this.object,
      'playerOverlays.playerOverlayRenderer.endScreen.watchNextEndScreenRenderer.results',
    );
    if (overlays === undefined) return;

    overlays.unshift(overlays[index - 1]);
    overlays.splice(index, 1);
  }

  function fixAutoplay() {
    const secondaryResults = getObjectByPath(
      this.object,
      'contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results',
    );
    if (secondaryResults === undefined) return;

    const autoPlay = getObjectByPath(secondaryResults, 'compactAutoplayRenderer');
    if (autoPlay === undefined) return;

    if (autoPlay.contents.length === 0) {
      const regularVid = secondaryResults.findIndex(x => has.call(x, 'compactVideoRenderer'));
      autoPlay.contents.push(secondaryResults[regularVid]);
      secondaryResults.splice(regularVid, 1);
      fixOverlay.call(this, regularVid);
    }
  }

  function modifyMenu(obj) {
    if (!has.call(obj, 'shortBylineText')) return;
    if (!has.call(obj, 'menu')) obj.menu = { menuRenderer: { items: [] } };
    const items = obj.menu.menuRenderer.items;
    const blockCh = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Channel' }] } } };
    const blockVid = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Video' }] } } };
    items.push(blockVid, blockCh);
  }

  function addContextMenus(o) {
    const attr = contextMenuObjects.find(e => has.call(o, e));
    if (attr !== undefined) {
      modifyMenu(o[attr]);
      return;
    }
    if (o instanceof Object) Object.keys(o).forEach(x => addContextMenus(o[x]));
  }

  function menuOnTap(event) {
    let data;
    let type;
    const parentDom = this.parentComponent.eventSink_.parentComponent;
    const parent = parentDom.data;

    switch (this.getElementsByTagName('yt-formatted-string')[0].textContent) {
      case 'Block Channel': {
        type = 'channelId';
        data = parent.shortBylineText.runs || parent.shortBylineText.simpleText;
        break;
      }
      case 'Block Video': {
        type = 'videoId';
        data = parent;
        break;
      }
    }

    if (data && type) {
      postMessage('contextBlockData', { type, info: data });
      parentDom.setAttribute('is-dismissed', '');
      // TODO: Menu does not close without this timeout
      setTimeout(() => parentDom.parentElement.removeChild(parentDom), 100);
    } else if (this.onTap_) {
      return this.onTap_(event);
    }
  }

  function setPolymerHook(v) {
    return function () {
      if (arguments[0].is === 'ytd-menu-service-item-renderer') {
        arguments[0].onTapHook_ = menuOnTap;
        arguments[0].listeners.tap = 'onTapHook_';
      }
      return v.apply(null, arguments);
    }
  }

  function startHook() {

    // hook ytInitialData
    Object.defineProperty(window, 'ytInitialData', {
      enumerable: true,
      configurable: true,
      get() {
        return this._ytInitialData;
      },
      set(v) {
        addContextMenus(v.contents);
        let postActions = [removeRvs, fixAutoplay];
        if (currentBlock) postActions.push(redirectToNext);
        ObjectFilter(v, blockRules, postActions);
        this._ytInitialData = v;
      },
    });

    // hook ytInitialPlayerResponse
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      enumerable: true,
      configurable: true,
      get() {
        return this._ytInitialPlayerResponse;
      },
      set(v) {
        ObjectFilter(v, ytPlayerRules);
        this._ytInitialPlayerResponse = v;
      },
    });

    Object.defineProperty(window.ytplayer, 'config', {
      enumerable: true,
      configurable: true,
      get() {
        return this._ytplayer;
      },
      set(v) {
        ObjectFilter(v, ytPlayerRules);
        this._ytplayer = v;
      },
    });

    // hook sidemenu
    Object.defineProperty(window, 'ytInitialGuideData', {
      enumerable: true,
      configurable: true,
      get() {
        return this._ytInitialGuideData;
      },
      set(v) {
        if (!has.call(this, '_ytInitialGuideData')) {
          ObjectFilter(v, guideRules);
          this._ytInitialGuideData = v;
        }
      },
    });

    if (/\/embed\/.*/.test(new URL(document.location).pathname)) {
      Object.defineProperty(window.yt, 'setConfig', {
        set(v) {
          this._setConfig = v;
        },
        get() {
          return filterEmbed(this._setConfig);
        }
      });
    }

    // hook onreadystatechange
    const desc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'onreadystatechange');
    Object.defineProperty(XMLHttpRequest.prototype, 'onreadystatechange', {
      get() {
        return filterXHR;
      },
      set(v) {
        this._orgCallback = v;
        desc.set.call(this, filterXHR);
      },
    });
  }

  // !! Start
  console.info('BlockTube Init');
  window.ytInitialData = {};
  window.ytplayer = {};
  window.ytInitialGuideData = {};
  window.ytInitialPlayerResponse = {};
  if (!has.call(window, 'yt')) window.yt = { setConfig: undefined };

  // listen for any changes in storageData
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data.from || event.data.from !== 'BLOCKTUBE_CONTENT') return;

    switch (event.data.type) {
      case 'storageData': {
        if (event.data.data === undefined) break;
        transformToRegExp(event.data.data);
        storageData = event.data.data;
        if (storageData.options.trending === true && !init) blockTrending();
        break;
      }
    }
    if (!init) {
      startHook();
      init = true;
    }
  }, true);

  // hook polymer
  Object.defineProperty(window, 'Polymer', {
    get() {
      return this._polymer;
    },
    set(v) {
      if (v instanceof Function && v.name === 'bound ') this._polymer = setPolymerHook(v);
      else this._polymer = v;
    }
  });

  // signal content script
  postMessage('ready');
}());
