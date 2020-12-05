(function blockTube() {
  'use strict';
  const has = Object.prototype.hasOwnProperty;

  // Thanks to uBlock origin
  const defineProperty = function(chain, cValue, middleware = undefined) {
    let aborted = false;
    const mustAbort = function(v) {
      if ( aborted ) { return true; }
      aborted =
            (v !== undefined && v !== null) &&
            (cValue !== undefined && cValue !== null) &&
            (typeof v !== typeof cValue);
      return aborted;
    };
    // https://github.com/uBlockOrigin/uBlock-issues/issues/156
    //   Support multiple trappers for the same property.
    const trapProp = function(owner, prop, configurable, handler) {
      if ( handler.init(owner[prop]) === false ) { return; }
      const odesc = Object.getOwnPropertyDescriptor(owner, prop);
      let prevGetter, prevSetter;
      if ( odesc instanceof Object ) {
        if ( odesc.configurable === false ) { return; }
        if ( odesc.get instanceof Function ) {
          prevGetter = odesc.get;
        }
        if ( odesc.set instanceof Function ) {
          prevSetter = odesc.set;
        }
      }
      Object.defineProperty(owner, prop, {
        configurable,
        get() {
          if ( prevGetter !== undefined ) {
            prevGetter();
          }
          return handler.getter(); // cValue
        },
        set(a) {
          if ( prevSetter !== undefined ) {
            prevSetter(a);
          }
          handler.setter(a);
        }
      });
    };
    const trapChain = function(owner, chain) {
      const pos = chain.indexOf('.');
      if ( pos === -1 ) {
        trapProp(owner, chain, false, {
          v: undefined,
          init: function(v) {
            if ( mustAbort(v) ) { return false; }
            this.v = v;
            return true;
          },
          getter: function() {
            return cValue;
          },
          setter: function(a) {
            if (middleware instanceof Function) {
              cValue = a;
              middleware(a);
            } else {
              if ( mustAbort(a) === false ) { return; }
              cValue = a;
            }
          }
        });
        return;
      }
      const prop = chain.slice(0, pos);
      const v = owner[prop];
      chain = chain.slice(pos + 1);
      if ( v instanceof Object || typeof v === 'object' && v !== null ) {
        trapChain(v, chain);
        return;
      }
      trapProp(owner, prop, true, {
        v: undefined,
        init: function(v) {
          this.v = v;
          return true;
        },
        getter: function() {
          return this.v;
        },
        setter: function(a) {
          this.v = a;
          if ( a instanceof Object ) {
            trapChain(a, chain);
          }
        }
      });
    };
    trapChain(window, chain);
  }

  // !! Globals

  window.btReloadRequired = false;

  // extension storageData
  let storageData;

  // JavaScript filtering
  let jsFilter;
  let jsFilterEnabled = false;

  // TODO: hack for blocking data in other objects
  let currentBlock = false;

  // add context menu to following objects
  const contextMenuObjects = [
    'backstagePostRenderer',
    'postRenderer',
    'movieRenderer',
    'videoRenderer',
    'gridVideoRenderer',
    'compactVideoRenderer',
    'videoPrimaryInfoRenderer',
    'commentRenderer',
  ];

  // those properties can be safely deleted when one of thier child got filtered
  const deleteAllowed = [
    'richItemRenderer',
    'content',
    'horizontalListRenderer',
    'verticalListRenderer',
    'shelfRenderer',
    'gridRenderer',
    'expandedShelfContentsRenderer',
    'comment',
    'commentThreadRenderer',
  ];

  // those filter properties require RegExp checking
  const regexProps = [
    'videoId',
    'channelId',
    'channelName',
    'title',
    'comment',
  ];

  // TODO: add rules descriptions
  // !! Filter Rules definitions
  const baseRules = {
    videoId: 'videoId',
    channelId: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
    channelBadges: 'ownerBadges',
    channelName: [
      'shortBylineText.runs',
      'shortBylineText.simpleText',
      'longBylineText.simpleText',
    ],
    title: ['title.runs', 'title.simpleText'],
    vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text.simpleText',
    viewCount: [
        'viewCountText.simpleText',
        'viewCountText.runs'
    ],
    badges: 'badges',
    publishTimeText: 'publishedTimeText.simpleText',
  };

  const filterRules = {
    main: {
      movieRenderer: baseRules,
      gridVideoRenderer: baseRules,
      videoRenderer: baseRules,
      radioRenderer: baseRules,
      playlistRenderer: baseRules,
      gridRadioRenderer: baseRules,
      compactVideoRenderer: baseRules,
      compactRadioRenderer: baseRules,
      playlistVideoRenderer: baseRules,
      endScreenVideoRenderer: baseRules,
      endScreenPlaylistRenderer: baseRules,
      gridPlaylistRenderer: baseRules,
      postRenderer: {
        channelId: 'navigationEndpoint.browseEndpoint.browseId',
        channelName: ['authorText.runs', 'authorText.simpleText']
      },
      backstagePostRenderer: {
        channelId: 'navigationEndpoint.browseEndpoint.browseId',
        channelName: ['authorText.runs', 'authorText.simpleText']
      },

      watchCardCompactVideoRenderer: {
        title: 'title.runs',
        channelId: 'subtitles.runs.navigationEndpoint.browseEndpoint.browseId',
        channelName: 'subtitles.runs',
        videoId: 'navigationEndpoint.watchEndpoint.videoId',
      },

      shelfRenderer: {
        channelId: 'endpoint.browseEndpoint.browseId',
      },

      channelVideoPlayerRenderer: {
        title: 'title.runs',
      },

      channelRenderer: {
        properties: {...baseRules, title: undefined},
        related: 'shelfRenderer'
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
        channelName: ['title', 'formattedTitle.simpleText'],
      },

      universalWatchCardRenderer: {
        properties: {
          channelId: 'header.watchCardRichHeaderRenderer.titleNavigationEndpoint.browseEndpoint.browseId',
          channelName: 'header.watchCardRichHeaderRenderer.title.simpleText',
        },
      },

      playlist: {
        properties: {
          channelId: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
          channelName: ['shortBylineText.runs', 'shortBylineText.simpleText'],
          title: 'title',
        },
        customFunc: redirectToIndex,
      },

      compactChannelRecommendationCardRenderer: {
        properties: {
          channelId: 'channelEndpoint.browseEndpoint.browseId',
          channelName: ['channelTitle.simpleText', 'channelTitle.runs'],
        },
      },
    },
    ytPlayer: {
      args: {
        properties: {
          videoId: ['video_id', 'raw_player_response.videoDetails.videoId'],
          channelId: ['ucid', 'raw_player_response.videoDetails.channelId'],
          channelName: ['author', 'raw_player_response.videoDetails.author'],
          title: ['title', 'raw_player_response.videoDetails.title'],
          vidLength: ['length_seconds', 'raw_player_response.videoDetails.lengthSeconds']
        }
      },
      videoDetails: {
        properties: {
          videoId: 'videoId',
          channelId: 'channelId',
          channelName: 'author',
          title: 'title',
          vidLength: 'lengthSeconds',
        },
        customFunc: disablePlayer,
      },
      PLAYER_VARS: {
        properties: {
          videoId: ['video_id'],
          channelId: ['embedded_player_response_parsed.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.subscribeButton.subscribeButtonRenderer.channelId'],
          channelName: ['embedded_player_response_parsed.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.title.runs'],
          title: ['embedded_player_response_parsed.embedPreview.thumbnailPreviewRenderer.title.runs'],
          vidLength: ['embedded_player_response_parsed.embedPreview.thumbnailPreviewRenderer.videoDurationSeconds']
        },
        customFunc: disableEmbedPlayer
      }
    },
    guide: {
      // sidemenu subscribed channels
      guideEntryRenderer: {
        properties: {
          channelId: 'navigationEndpoint.browseEndpoint.browseId',
          channelName: ['title', 'formattedTitle.simpleText'],
        },
      },
    },
    comments: {
      commentRenderer: {
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: 'authorText.simpleText',
        comment: ['contentText.runs', 'contentText.simpleText'],
      },
      liveChatTextMessageRenderer: {
        channelId: 'authorExternalChannelId',
        channelName: 'authorName.simpleText',
        comment: 'message.runs',
      },
    }
  }

  // !! ObjectFilter
  function ObjectFilter(object, filterRules, postActions = [], contextMenus = false) {
    if (!(this instanceof ObjectFilter))
      return new ObjectFilter(object, filterRules, postActions, contextMenus);

    this.object = object;
    this.filterRules = filterRules;
    this.contextMenus = contextMenus;

    this.filter();
    postActions.forEach(x => x.call(this));
    return this;
  }

  ObjectFilter.prototype.isDataEmpty = function () {
    if (!isNaN(storageData.filterData.vidLength[0]) ||
        !isNaN(storageData.filterData.vidLength[1])) return false;

    for (let idx = 0; idx < regexProps.length; idx += 1) {
      if (storageData.filterData[regexProps[idx]].length > 0) return false;
    }

    return !jsFilterEnabled;
  };

  ObjectFilter.prototype.matchFilterData = function (filters, obj, objectType) {
    const friendlyVideoObj = {};

    let doBlock = Object.keys(filters).some((h) => {
      const filterPath = filters[h];
      if (filterPath === undefined) return false;

      const properties = storageData.filterData[h];
      if (!jsFilterEnabled && (properties === undefined || properties.length === 0)) return false;

      const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
      let value;
      for (let idx = 0; idx < filterPathArr.length; idx += 1) {
        value = getObjectByPath(obj, filterPathArr[idx]);
        if (value !== undefined) break;
      }

      if (value === undefined) return false;

      // badges are also arrays, but they're processed later on.
      if (!(h === 'channelBadges' || h === 'badges') && value instanceof Array) {
        value = this.flattenRuns(value);
      }

      if (regexProps.includes(h) && properties.some(prop => prop && prop.test(value))) {
        return true;
      } else if (h === 'vidLength') {
        const vidLen = parseTime(value);
        if (vidLen > 0 && properties.length === 2) {
          if (storageData.options.vidLength_type === 'block') {
            if ((properties[0] !== null && vidLen >= properties[0]) && (properties[1] !== null && vidLen <= properties[1])) return true;
          } else {
            if ((properties[0] !== null && vidLen < properties[0]) || (properties[1] !== null && vidLen > properties[1])) return true;
          }

          if (jsFilterEnabled) friendlyVideoObj[h] = vidLen;
        }
      } else if (jsFilterEnabled) {
        if (h === 'viewCount') {
          friendlyVideoObj[h] = parseViewCount(value);
        } else if (h === 'channelBadges' || h === 'badges') {
          const badges = [];
          value.forEach(br => {
            /* Channels */
            if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_VERIFIED") {
              badges.push("verified");
            } else if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_VERIFIED_ARTIST") {
              badges.push("artist");
            }
            /* Videos */
            else if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_LIVE_NOW") {
              badges.push("live");
            }
          });
          friendlyVideoObj[h] = badges;
        } else {
          friendlyVideoObj[h] = value;
        }
      }

      return false;
    });

    if (!doBlock && jsFilterEnabled) {
      // force return value into boolean just in case someone tries returning something else
      try {
        doBlock = !!jsFilter(friendlyVideoObj, objectType);
      } catch (e) {
        console.error("Custom function exception", e);
      }
    }

    return doBlock;
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
    if (this.isDataEmpty()) return [];

    return Object.keys(this.filterRules).reduce((res, h) => {
      let properties;
      let customFunc;
      let related;
      const filteredObject = obj[h];

      if (filteredObject) {
        const filterRule = this.filterRules[h];
        if (has.call(filterRule, 'properties')) {
          properties = filterRule.properties;
          customFunc = filterRule.customFunc;
          related = filterRule.related;
        } else {
          properties = filterRule;
          customFunc = undefined;
          related = undefined;
        }

        const isMatch = storageData.options.mixes && h === 'radioRenderer' || this.matchFilterData(properties, filteredObject, h);
        if (isMatch) {
          res.push({
            name: h,
            customFunc,
            related,
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

    // object filtering
    const matchedRules = this.matchFilterRule(obj);
    matchedRules.forEach((r) => {
      let customRet = true;
      if (r.customFunc !== undefined) {
        customRet = r.customFunc.call(this, obj, r.name);
      }
      if (customRet) {
        delete obj[r.name];
        deletePrev = r.related || true;
      }
    });

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
        // Hack for deleting related objects with missing data
        if (typeof childDel === "string" && obj.length > 0 && obj[idx] && obj[idx][childDel]) {
          obj.splice(idx, 1);
        }
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

    if (this.contextMenus) addContextMenus(obj);
    return deletePrev;
  };

  // !! Custom filtering functions

  function disableEmbedPlayer(ytData) {
    if (storageData.options.suggestions_only) {
      return false;
    }

    censorTitle();
    return true;
  }

  function disablePlayer(ytData) {
    if (storageData.options.suggestions_only) {
      return false;
    }

    const message = (storageData.options.block_message) || '';
    for (const prop of Object.getOwnPropertyNames(ytData)) {
      try {
        delete ytData[prop];
      } catch (e) { }
    }
    ytData.playabilityStatus = {
      status: 'ERROR',
      reason: message,
      errorScreen: {
        playerErrorMessageRenderer: {
          reason: {
            simpleText: message,
          },
          thumbnail: {
            thumbnails: [{
              url: '//s.ytimg.com/yts/img/meh7-vflGevej7.png',
              width: 140,
              height: 100,
            }]
          },
          icon: {
            iconType: 'ERROR_OUTLINE',
          }
        }
      }
    };

    currentBlock = true;
  }

  function blockPlaylistVid(pl) {
    const vid = pl.playlistPanelVideoRenderer;
    const message = (storageData.options.block_message) || '';

    vid.videoId = 'undefined';

    vid.unplayableText = {
      simpleText: `${message}`,
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
    if (storageData && storageData.options.suggestions_only) {
      return false;
    }

    if (this && this.object) this.object = undefined;
    document.location = '/';
    // TODO: Hack for stoping execution
    throw 0;
  }

  function censorTitle() {
    const listener = function () {
      document.title = 'YouTube';
      window.removeEventListener('yt-update-title', listener);
    };
    window.addEventListener('yt-update-title', listener);

    window.addEventListener('load', () => {
      document.title = 'YouTube';
    });
  }

  function redirectToNext() {
    currentBlock = false;

    if (storageData.options.suggestions_only) {
      return false;
    }

    censorTitle();

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

  function postMessage(type, data) {
    window.postMessage({ from: 'BLOCKTUBE_PAGE', type, data }, document.location.origin);
  }

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

  function parseViewCount(viewCount) {
    let views = viewCount.split(" ")[0]; // RTL languages might be an issue here
    views = parseInt(views.replace(/[.,]/g, ""));
    return views;
  }

  function transformToRegExp(data) {
    if (!has.call(data, 'filterData')) return;

    regexProps.forEach((p) => {
      if (has.call(data.filterData, p)) {
        data.filterData[p] = data.filterData[p].map((v) => {
          try {
            return RegExp(v[0], v[1].replace('g', ''));
          } catch (e) {
            console.error(`RegExp parsing error: /${v[0]}/${v[1]}`);
            return undefined;
          }
        });
      }
    });
  }

  function fetchFilter(url, resp) {
    if (['/youtubei/v1/search', '/youtubei/v1/browse', '/youtubei/v1/next'].includes(url.pathname)) {
      ObjectFilter(resp, filterRules.main, [], true);
    }
    else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    }
  }

  function spfFilter(url, resp) {
    let ytDataArr = resp.part || resp.response.parts || resp.response;
    ytDataArr = (ytDataArr instanceof Array) ? ytDataArr : [ytDataArr];

    ytDataArr.forEach((obj) => {
      if (has.call(obj, 'player')) {
        try {
          const player_resp = getObjectByPath(obj.player, 'args.player_response');
          obj.player.args.raw_player_response = JSON.parse(player_resp);
        } catch (e) { }
        ObjectFilter(obj.player, filterRules.ytPlayer);
      }

      if (has.call(obj, 'playerResponse')) {
        ObjectFilter(obj.playerResponse, filterRules.ytPlayer);
      }

      if (has.call(obj, 'response') || has.call(obj, 'data')) {
        let rules;
        let postActions = [];
        switch (url.pathname) {
          case '/guide_ajax':
            rules = filterRules.guide;
            break;
          case '/comment_service_ajax':
          case '/live_chat/get_live_chat':
            rules = filterRules.comments;
            break;
          case '/watch':
            postActions = [removeRvs, fixAutoplay];
            if (currentBlock) postActions.push(redirectToNext);
          default:
            rules = filterRules.main;
        }
        ObjectFilter(obj.response || obj.data, rules, postActions, true);
      }
    });
  }

  function blockMixes(data) {
    data.filterData.channelName.push(/^YouTube$/);
  }

  function blockTrending(data) {
    if (document.location.pathname === '/feed/trending') {
      redirectToIndex();
    }

    data.filterData.channelId.push(/^FEtrending$/);
  }

  function removeRvs() {
    if (has.call(this.object, 'webWatchNextResponseExtensionData')) {
      delete this.object.webWatchNextResponseExtensionData;
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

  function addContextMenus(obj) {
    const attr = contextMenuObjects.find(e => has.call(obj, e));
    if (attr === undefined) return;

    let items;
    let hasChannel = false;
    let hasVideo = false;
    if (has.call(obj[attr], 'videoActions')) {
      items = obj[attr].videoActions.menuRenderer.items;
      hasChannel = true;
      hasVideo = true;
    } else if (has.call(obj[attr], 'actionMenu')) {
      items = obj[attr].actionMenu.menuRenderer.items;
      hasChannel = true;
    } else if (attr === 'commentRenderer') {
      obj[attr].actionMenu = {menuRenderer: {items: [] } };
      items = obj[attr].actionMenu.menuRenderer.items;
      hasChannel = true;
    } else {
      if (!has.call(obj[attr], 'shortBylineText')) return;
      items = getObjectByPath(obj[attr], 'menu.menuRenderer.items');
      const topLevel = getObjectByPath(obj[attr], 'menu.menuRenderer.topLevelButtons');
      if (!items && !topLevel) {
        obj[attr].menu = { menuRenderer: { items: [] } };
        items = obj[attr].menu.menuRenderer.items;
      }
      if (topLevel) {
        obj[attr].menu.menuRenderer.items = [];
        items = obj[attr].menu.menuRenderer.items;
      }
      hasChannel = true;
      hasVideo = true;
    }
    const blockCh = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Channel' }] } } };
    const blockVid = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Video' }] } } };
    if (items instanceof Array){
      if (hasChannel) items.push(blockCh);
      if (hasVideo) items.push(blockVid);
    }
  }

  function startHook() {
    const currentUrl = new URL(document.location);
    if (currentUrl.pathname.startsWith('/embed/')) {
      const ytConfigPlayerConfig = getObjectByPath(window, 'yt.config_.PLAYER_VARS');
      if (typeof ytConfigPlayerConfig === 'object' && ytConfigPlayerConfig !== null) {
        try {
          ytConfigPlayerConfig.embedded_player_response_parsed = JSON.parse(ytConfigPlayerConfig.embedded_player_response);
        } catch (e) { }
        ObjectFilter(window.yt.config_, filterRules.ytPlayer);
      } else {
        defineProperty('yt.config_.PLAYER_VARS', undefined, (v) => {
          try {
            v.embedded_player_response_parsed = JSON.parse(v.embedded_player_response);
          } catch (e) { }
          ObjectFilter(window.yt.config_, filterRules.ytPlayer)
        });
      }
    }

    const ytPlayerconfig = getObjectByPath(window, 'ytplayer.config');
    if (typeof ytPlayerconfig === 'object' && ytPlayerconfig !== null) {
      ObjectFilter(window.ytplayer.config, filterRules.ytPlayer);
    } else {
      defineProperty('ytplayer.config', undefined, (v) => {
        const playerResp = getObjectByPath(v, 'args.player_response');
        if (playerResp) {
          try {
            v.args.raw_player_response = JSON.parse(playerResp);
          } catch (e) { }
        }
        ObjectFilter(window.ytplayer.config, filterRules.ytPlayer)
      });
    }

    if (typeof window.ytInitialGuideData === 'object' && window.ytInitialGuideData !== null) {
      ObjectFilter(window.ytInitialGuideData, filterRules.guide);
    } else {
      defineProperty('ytInitialGuideData', undefined, (v) => ObjectFilter(v, filterRules.guide));
    }

    if (typeof window.ytInitialPlayerResponse === 'object' && window.ytInitialPlayerResponse !== null) {
      ObjectFilter(window.ytInitialPlayerResponse, filterRules.ytPlayer);
    } else {
      defineProperty('ytInitialPlayerResponse', undefined, (v) => ObjectFilter(v, filterRules.ytPlayer));
    }

    const postActions = [removeRvs, fixAutoplay];
    if (typeof window.ytInitialData === 'object' && window.ytInitialData !== null) {
      ObjectFilter(window.ytInitialData, Object.assign(filterRules.main, filterRules.comments), (window.ytInitialData.contents && currentBlock) ? postActions.concat(redirectToNext) : postActions, true);
    } else {
      defineProperty('ytInitialData', undefined, (v) => {
        ObjectFilter(v, Object.assign(filterRules.main, filterRules.comments), (v.contents && currentBlock) ? postActions.concat(redirectToNext) : postActions, true)
      });
    }

    window.btDispatched = true;
    window.dispatchEvent(new Event('blockTubeReady'));
  }

  function storageReceived(data) {
    if (data === undefined) return;
    transformToRegExp(data);
    if (data.options.trending) blockTrending(data);
    if (data.options.mixes) blockMixes(data);

    const shouldStartHook = (storageData === undefined);
    storageData = data;

    // Enable JS filtering only if function has something in it
    if (storageData.options.enable_javascript && storageData.filterData.javascript) {
      try {
        jsFilter = eval(storageData.filterData.javascript);
        if (!(jsFilter instanceof Function)) {
          throw Error("Function not found");
        }
        jsFilterEnabled = storageData.options.enable_javascript;
      } catch (e) {
        console.error("Custom function syntax error", e);
        jsFilterEnabled = false;
      }
    } else {
      jsFilterEnabled = false;
    }

    if (shouldStartHook) {
      startHook();
    }
  }

  function openToast(msg, duration) {
    const ytdApp = document.getElementsByTagName('ytd-app')[0];
    if (ytdApp === undefined) return;
    const ytEvent = new CustomEvent('yt-action', {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {
        actionName: 'yt-open-popup-action',
        args: [
          {
            openPopupAction: {
              durationHintMs: duration,
              popup: {
                notificationActionRenderer: {
                  responseText: {
                    runs: [{
                      text: msg
                    }]
                  }
                }
              },
              popupType: 'TOAST'
            }
          },
          ytdApp,
          undefined],
        returnValue: [],
        disableBroadcast: false,
        optionalAction: true
      }
    });
    ytdApp.dispatchEvent(ytEvent);
  }

  // !! Start
  console.info('BlockTube Init');

  // listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data.from || event.data.from !== 'BLOCKTUBE_CONTENT') return;

    switch (event.data.type) {
      case 'storageData': {
        storageReceived(event.data.data);
        break;
      }
      case 'reloadRequired':
        window.btReloadRequired = true;
        openToast("BlockTube was updated, Please reload this tab to reactivate it", 15000);
        break;
      default:
        break;
    }
  }, true);

  window.btExports = {
    spfFilter,
    fetchFilter,
    openToast
  }
}());
