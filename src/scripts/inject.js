(function blockTube() {
  'use strict';
  const has = Object.prototype.hasOwnProperty;

  // !! Globals

  // extension storageData
  let storageData;

  // TODO: hack for blocking data in other objects
  let currentBlock = false;

  // add context menu to following objects
  const contextMenuObjects = [
    'videoRenderer',
    'gridVideoRenderer',
    'compactVideoRenderer',
    'videoPrimaryInfoRenderer',
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
    channelName: [
      'shortBylineText.runs',
      'shortBylineText.simpleText',
      'longBylineText.simpleText',
    ],
    title: ['title.runs', 'title.simpleText'],
    vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text.simpleText',
  };

  const filterRules = {
    main: {
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
        channelName: 'title',
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
          videoId: ['video_id', 'player_response_parsed.videoDetails.videoId'],
          channelId: ['ucid', 'player_response_parsed.videoDetails.channelId'],
          channelName: ['author', 'player_response_parsed.videoDetails.author'],
          title: ['title', 'player_response_parsed.videoDetails.title'],
          vidLength: ['length_seconds', 'player_response_parsed.videoDetails.lengthSeconds']
        },
        customFunc: setPageBlock
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
    },
    guide: {
      // sidemenu subscribed channels
      guideEntryRenderer: {
        properties: {
          channelId: 'navigationEndpoint.browseEndpoint.browseId',
          channelName: 'title',
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

    return true;
  };

  ObjectFilter.prototype.matchFilterData = function (filters, obj) {
    return Object.keys(filters).some((h) => {
      const filterPath = filters[h];
      if (filterPath === undefined) return false;

      const properties = storageData.filterData[h];
      if (properties === undefined || properties.length === 0) return false;

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

        const isMatch = this.matchFilterData(properties, filteredObject);
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

  function setPageBlock() {
    if (storageData.options.suggestions_only) {
      return false;
    }

    currentBlock = true;
    return true;
  }

  function disablePlayer(ytData) {
    if (storageData.options.suggestions_only) {
      return false;
    }

    const message = (storageData.options.block_message) || '';

    ytData.playabilityStatus.status = 'ERROR';
    ytData.playabilityStatus.reason = message;
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
    window.postMessage({ from: 'BLOCKTUBE_PAGE', type, data }, document.locaion.origin);
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

  function spfFilter(url, resp) {
    let ytDataArr = resp.part || resp.response.parts || resp.response;
    ytDataArr = (ytDataArr instanceof Array) ? ytDataArr : [ytDataArr];

    ytDataArr.forEach((obj) => {
      if (has.call(obj, 'player')) {
        try {
          const player_resp = getObjectByPath(obj.player, 'args.player_response');
          obj.player.args.player_response_parsed = JSON.parse(player_resp);
        } catch (e) {}
        ObjectFilter(obj.player, filterRules.ytPlayer);
      }

      if (has.call(obj, 'playerResponse')) {
        ObjectFilter(obj.playerResponse, filterRules.ytPlayer);
      }

      if (has.call(obj, 'response')) {
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
        ObjectFilter(obj.response, rules, postActions, true);
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
    if (has.call(obj[attr], 'videoActions')) {
      items = obj[attr].videoActions.menuRenderer.items;
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
    }
    const blockCh = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Channel' }] } } };
    const blockVid = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Video' }] } } };
    if (items instanceof Array) items.push(blockVid, blockCh);
  }

  function startHook() {
    const currentUrl = new URL(document.location);
    if (currentUrl.pathname.startsWith('/embed/')) {
      window.yt = window.yt || {};
      window.yt.config_ = window.yt.config_ || {};
      if (!window.yt.config_.PLAYER_CONFIG) {
        Object.defineProperty(window.yt.config_, 'PLAYER_CONFIG', {
          get() {
            return this.PLAYER_CONFIG_;
          },
          set(val) {
            ObjectFilter(val, filterRules.ytPlayer);
            this.PLAYER_CONFIG_ = val;
          },
        });
      } else {
        ObjectFilter(window.yt.config_.PLAYER_CONFIG, filterRules.ytPlayer);
      }
    }

    window.ytplayer = window.ytplayer || {};
    if (!window.ytplayer.config) {
      Object.defineProperty(window.ytplayer, 'config', {
        get() {
          return this.config_;
        },
        set(val) {
          const player_resp = getObjectByPath(val, 'args.player_response');
          if (player_resp) {
              try {
                  val.args.player_response_parsed = JSON.parse(player_resp);
              } catch (e) {
              }
          }
          ObjectFilter(val, filterRules.ytPlayer);
          this.config_ = val;
        },
      });
    } else {
      ObjectFilter(window.ytplayer.config, filterRules.ytPlayer);
    }

    if (!window.ytInitialGuideData) {
      Object.defineProperty(window, 'ytInitialGuideData', {
        get() {
          return this.ytInitialGuideData_;
        },
        set(val) {
          ObjectFilter(val, filterRules.guide);
          this.ytInitialGuideData_ = val;
        },
      });
    } else {
      ObjectFilter(window.ytInitialGuideData, filterRules.guide);
    }

    if (!window.ytInitialPlayerResponse) {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get() {
          return this.ytInitialPlayerResponse_;
        },
        set(val) {
          ObjectFilter(val, filterRules.ytPlayer);
          this.ytInitialPlayerResponse_ = val;
        },
      });
    } else {
      ObjectFilter(window.ytInitialPlayerResponse, filterRules.ytPlayer);
    }

    const postActions = [removeRvs, fixAutoplay];
    if (!window.ytInitialData) {
      Object.defineProperty(window, 'ytInitialData', {
        get() {
          return this.ytInitialData_;
        },
        set(val) {
          if (val.contents && currentBlock) postActions.push(redirectToNext);
          ObjectFilter(val, Object.assign(filterRules.main, filterRules.comments), postActions, true);
          this.ytInitialData_ = val;
        },
      });
    } else {
      if (window.ytInitialData.contents && currentBlock) postActions.push(redirectToNext);
      ObjectFilter(window.ytInitialData, Object.assign(filterRules.main, filterRules.comments), postActions, true);
    }

    window.btDispatched = true;
    window.dispatchEvent(new Event('blockTubeReady'));
  }

  function storageRecieved(data) {
    if (data === undefined) return;
    transformToRegExp(data);
    if (data.options.trending) blockTrending(data);
    if (data.options.mixes) blockMixes(data);
    if (storageData === undefined) {
      storageData = data;
      startHook();
    } else {
      storageData = data;
    }
  }

  // !! Start
  console.info('BlockTube Init');

  // listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data.from || event.data.from !== 'BLOCKTUBE_CONTENT') return;

    switch (event.data.type) {
      case 'storageData': {
        storageRecieved(event.data.data);
        break;
      }
      default:
        break;
    }
  }, true);

  window.btExports = {
    spfFilter,
  }
}());
