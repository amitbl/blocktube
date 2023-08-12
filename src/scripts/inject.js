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
        trapProp(owner, chain, true, {
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
    'compactMovieRenderer',
    'videoRenderer',
    'gridVideoRenderer',
    'compactVideoRenderer',
    'videoPrimaryInfoRenderer',
    'commentRenderer',
    'playlistPanelVideoRenderer',
    'reelItemRenderer'
  ];

  // those properties can be safely deleted when one of thier child got filtered
  const deleteAllowed = [
    'richItemRenderer',
    'content',
    'horizontalListRenderer',
    'verticalListRenderer',
    'shelfRenderer',
    'richShelfRenderer',
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
    percentWatched: 'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched'
  };

  const filterRules = {
    main: {
      compactMovieRenderer: {
        videoId: 'videoId',
        title: ['title.runs', 'title.simpleText'],
        vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text.simpleText',
        badges: 'badges',
        percentWatched: 'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched'
      },
      movieRenderer: {
        videoId: 'videoId',
        title: ['title.runs', 'title.simpleText'],
        vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text.simpleText',
        badges: 'badges',
        percentWatched: 'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched'
      },
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

      playerOverlayAutoplayRenderer: {
        properties: {
          videoId: 'videoId',
          channelId: 'byline.runs.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'byline.runs.text',
          title: ['videoTitle.simpleText', 'videoTitle.runs'],
          publishTimeText: 'publishedTimeText.simpleText',
          vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text.simpleText',
        }
      },

      reelItemRenderer: {
        properties: {
          videoId: 'videoId',
          channelId: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelNavigationEndpoint.browseEndpoint.browseId',
          channelName: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelTitleText.runs.text',
          title: ['headline.simpleText', 'headline.runs'],
          publishTimeText: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.timestampText.simpleText'
        }
      },

      richShelfRenderer: {
        channelId: 'endpoint.browseEndpoint.browseId'
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
        },
        customFunc: disableEmbedPlayer,
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
          channelId: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.subscribeButton.subscribeButtonRenderer.channelId'],
          channelName: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.title.runs'],
          title: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.title.runs'],
          vidLength: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDurationSeconds']
        },
        customFunc: disableEmbedPlayer
      }
    },
    guide: {
      // sidemenu subscribed channels
      guideEntryRenderer: {
        properties: {
          channelId: ['navigationEndpoint.browseEndpoint.browseId', 'icon.iconType'],
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

  const mergedFilterRules = Object.assign(filterRules.main, filterRules.comments);

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
    if (storageData.options.shorts || storageData.options.movies || storageData.options.mixes) return false;
    if (!isNaN(storageData.options.percent_watched_hide)) return false;

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
      if (regexProps.includes(h) && (properties === undefined || properties.length === 0 && !jsFilterEnabled)) return false;

      const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
      let value;
      for (let idx = 0; idx < filterPathArr.length; idx += 1) {
        value = getObjectByPath(obj, filterPathArr[idx]);
        if (value !== undefined) break;
      }

      if (value === undefined) return false;

      if (h === 'percentWatched' && storageData.options.percent_watched_hide && objectType != 'playlistPanelVideoRenderer'
           && !['/feed/history', '/feed/library', '/playlist'].includes(document.location.pathname)
           && parseInt(value) >= storageData.options.percent_watched_hide) return true;

      // badges are also arrays, but they're processed later on.
      if (!(h === 'channelBadges' || h === 'badges') && value instanceof Array) {
        value = flattenRuns(value);
      }

      if (regexProps.includes(h) && properties.some(prop => prop && prop.test(value))) return true;

      if (h === 'vidLength') {
        const vidLen = parseTime(value);
        if (vidLen === -2 && storageData.options.shorts) {
          return true;
        }
        if (vidLen > 0 && properties.length === 2) {
          if (storageData.options.vidLength_type === 'block') {
            if ((properties[0] !== null && vidLen >= properties[0]) && (properties[1] !== null && vidLen <= properties[1])) return true;
          } else {
            if ((properties[0] !== null && vidLen < properties[0]) || (properties[1] !== null && vidLen > properties[1])) return true;
          }
        }
        value = vidLen;
      }

      if (jsFilterEnabled) {
        if (h === 'viewCount') {
          value = parseViewCount(value);
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
          value = badges;
        }
        friendlyVideoObj[h] = value;
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

  ObjectFilter.prototype.isExtendedMatched = function(filteredObject, h) {
    if (storageData.options.movies) {
      if (h === 'movieRenderer' || h === 'compactMovieRenderer') return true;
      if (h === 'videoRenderer' && !getObjectByPath(filteredObject, "shortBylineText.runs.navigationEndpoint.browseEndpoint") && filteredObject.longBylineText && filteredObject.badges) return true;
    }
    if (storageData.options.shorts && h === 'reelItemRenderer') return true;
    if (storageData.options.mixes && (h === 'radioRenderer' || h === 'compactRadioRenderer')) return true;

    return false;
  }

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

        const isMatch = this.isExtendedMatched(filteredObject, h) || this.matchFilterData(properties, filteredObject, h);
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

    const vidId = findNextVideo(this.object);
    if (vidId !== false) {
      document.location = `watch?v=${vidId}`;
    }
    secondary.secondaryResults = undefined;
  }

  // !! Utils

  function flattenRuns(arr) {
    if (!(arr instanceof Array)) return arr;
    return arr.reduce((res, v) => {
      if (has.call(v, 'text')) {
        res.push(v.text);
      }
      return res;
    }, []).join(' ');
  };

  function getFlattenByPath(obj, filterPath) {
    if (filterPath === undefined) return;
    const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
    let value;
    for (let idx = 0; idx < filterPathArr.length; idx += 1) {
      value = getObjectByPath(obj, filterPathArr[idx]);
      if (value !== undefined) return flattenRuns(value);
    }
  }

  function postMessage(type, data) {
    window.postMessage({ from: 'BLOCKTUBE_PAGE', type, data }, document.location.origin);
  }

  const deepGet = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

  function deepGetFirst(paths, o) {
    for (let i = 0; i < paths.length; i++) {
      let res = deepGet(paths[i], o);
      if (res) {
        return res;
      }
    }
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
    if (timeStr === 'SHORTS') {
      return -2;
    }
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

  function playerMiscFilters() {
    let start_obj = getObjectByPath(this.object, 'args.raw_player_response');
    start_obj = (start_obj) ? start_obj : this.object;

    if (storageData.options.disable_you_there === true) {
      const playerMessages = getObjectByPath(start_obj, 'messages', []);
      for (let i = playerMessages.length - 1; i >= 0; i -= 1) {
        if (has.call(playerMessages[i], 'youThereRenderer')) {
          playerMessages.splice(i, 1);
        }
      }
    }

    if (storageData.options.disable_db_normalize === true) {
      const audioConfig = getObjectByPath(start_obj, 'playerConfig.audioConfig');
      if (audioConfig !== undefined) {
        audioConfig.loudnessDb = null;
        audioConfig.perceptualLoudnessDb = null;
        audioConfig.enablePerFormatLoudness = false;
      }
      const streamConfig = getObjectByPath(start_obj, 'streamingData.adaptiveFormats', []);
      streamConfig.forEach((conf) => {
          if (conf.loudnessDb !== undefined) {
            conf.loudnessDb = 0.0;
          }
      })
    }
  }

  function fetchFilter(url, resp) {
    if (['/youtubei/v1/search', '/youtubei/v1/browse'].includes(url.pathname)) {
      ObjectFilter(resp, filterRules.main, [], true);
    }
    else if (url.pathname === '/youtubei/v1/next') {
      const postActions = [fixAutoplay];
      if (currentBlock) postActions.push(redirectToNext);
      ObjectFilter(resp, filterRules.main, postActions, true);
    }
    else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    }
    else if (url.pathname === '/youtubei/v1/player') {
      ObjectFilter(resp, filterRules.ytPlayer, [playerMiscFilters]);
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
        ObjectFilter(obj.player, filterRules.ytPlayer, [playerMiscFilters]);
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
            postActions = [fixAutoplay];
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
    if (document.location.pathname === '/feed/trending' || document.location.pathname === '/feed/explore') {
      redirectToIndex();
    }

    data.filterData.channelId.push(/^FEtrending$/);
    data.filterData.channelId.push(/^FEexplore$/);
  }

  function blockShorts(data) {
    if (document.location.pathname.startsWith('/shorts/')) {
      redirectToIndex();
    }

    data.filterData.channelId.push(/^TAB_SHORTS$/);
  }

  function fixAutoplay() {
    if (getObjectByPath(this.object, 'playerOverlays.playerOverlayRenderer.autoplay') === undefined) {
      return;
    }

    let autoplayOverlay = getObjectByPath(
      this.object,
      'playerOverlays.playerOverlayRenderer.autoplay.playerOverlayAutoplayRenderer',
    );
    if (autoplayOverlay !== undefined) return;

    let autoPlay = getObjectByPath(this.object, 'contents.twoColumnWatchNextResults.autoplay.autoplay.sets');
    if (autoPlay === undefined) return;
    autoPlay = autoPlay[0].autoplayVideo;
    if (autoPlay === undefined) return;
    try {
      const videoId = findNextVideo(this.object);
      if (videoId !== false) {
        autoPlay.videoId = videoId
        autoPlay.watchEndpoint.videoId = videoId
      } else {
        delete this.object.contents.twoColumnWatchNextResults.autoplay;
      }
      this.object.responseContext.webResponseContextExtensionData.webPrefetchData.navigationEndpoints = [];
    } catch (e) {
      delete this.object.contents.twoColumnWatchNextResults.autoplay;
    }
  }

  function findNextVideo(object) {
    let secondaryResults = getObjectByPath(
      object,
      'contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results',
    );
    if (secondaryResults === undefined) return false;

    const chipSection = secondaryResults.findIndex(x => has.call(x, 'itemSectionRenderer'));
    if (chipSection !== -1) {
      secondaryResults = getObjectByPath(secondaryResults[chipSection], 'itemSectionRenderer.contents');
      if (secondaryResults === undefined) return false;
    }

    const regularVid = secondaryResults.findIndex(x => has.call(x, 'compactVideoRenderer'));
    const vidObj = secondaryResults[regularVid].compactVideoRenderer;

    return vidObj.videoId;
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

      if (attr === 'movieRenderer' || attr === 'compactMovieRenderer') {
        hasChannel = false;
      } else if (has.call(obj[attr], 'shortBylineText') && getObjectByPath(obj[attr], 'shortBylineText.runs.navigationEndpoint.browseEndpoint')) {
        hasChannel = true;
      } else if (attr === 'reelItemRenderer') {
        hasChannel = true;
      }

      hasVideo = true;

      items = getObjectByPath(obj[attr], 'menu.menuRenderer.items');
      const topLevel = getObjectByPath(obj[attr], 'menu.menuRenderer.topLevelButtons');
      if (!items) {
        if (!topLevel) {
          obj[attr].menu = { menuRenderer: { items: [] } };
          items = obj[attr].menu.menuRenderer.items;
        } else {
          obj[attr].menu.menuRenderer.items = [];
          items = obj[attr].menu.menuRenderer.items;
        }
      }
    }

    if (items instanceof Array){
      const blockCh = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Channel' }] }, icon: {iconType: "NOT_INTERESTED"} } };
      const blockVid = { menuServiceItemRenderer: { text: { runs: [{ text: 'Block Video' }] }, icon: {iconType: "NOT_INTERESTED"} } };
      if (storageData.options.block_feedback)
        items.forEach((e) => {
          if (getObjectByPath(e, 'menuServiceItemRenderer.icon.iconType') === 'NOT_INTERESTED' && hasVideo) {
            blockVid.menuServiceItemRenderer.serviceEndpoint = JSON.parse(JSON.stringify(e.menuServiceItemRenderer.serviceEndpoint))
          } else if (getObjectByPath(e, 'menuServiceItemRenderer.icon.iconType') === 'REMOVE' && hasChannel) {
            blockCh.menuServiceItemRenderer.serviceEndpoint = JSON.parse(JSON.stringify(e.menuServiceItemRenderer.serviceEndpoint))
          }
        });
      if (hasChannel) items.push(blockCh);
      if (hasVideo) items.push(blockVid);

      if (hasChannel || hasVideo) {
        obj[attr]._btOriginalAttr = attr;
      }

    }
  }

  function startHook() {
    if (window.location.pathname.startsWith('/embed/')) {
      const ytConfigPlayerConfig = getObjectByPath(window, 'yt.config_.PLAYER_VARS');
      if (typeof ytConfigPlayerConfig === 'object' && ytConfigPlayerConfig !== null) {
        try {
          ytConfigPlayerConfig.raw_player_response = JSON.parse(ytConfigPlayerConfig.embedded_player_response);
        } catch (e) { }
        ObjectFilter(window.yt.config_, filterRules.ytPlayer, [playerMiscFilters]);
      } else {
        defineProperty('yt.config_', undefined, (v) => {
          try {
            if (has.call(v, 'PLAYER_VARS')) {
              v.PLAYER_VARS.raw_player_response = JSON.parse(v.PLAYER_VARS.embedded_player_response);
            }
          } catch (e) { }
          ObjectFilter(window.yt.config_, filterRules.ytPlayer, [playerMiscFilters])
        });
      }
    }

    const ytPlayerconfig = getObjectByPath(window, 'ytplayer.config');
    if (typeof ytPlayerconfig === 'object' && ytPlayerconfig !== null) {
      ObjectFilter(window.ytplayer.config, filterRules.ytPlayer, [playerMiscFilters]);
    } else {
      defineProperty('ytplayer.config', undefined, (v) => {
        const playerResp = getObjectByPath(v, 'args.player_response');
        if (playerResp) {
          try {
            v.args.raw_player_response = JSON.parse(playerResp);
          } catch (e) { }
        }
        ObjectFilter(window.ytplayer.config, filterRules.ytPlayer, [playerMiscFilters])
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

    const postActions = [fixAutoplay];
    if (typeof window.ytInitialData === 'object' && window.ytInitialData !== null) {
      ObjectFilter(window.ytInitialData, mergedFilterRules, (window.ytInitialData.contents && currentBlock) ? postActions.concat(redirectToNext) : postActions, true);
    } else {
      defineProperty('ytInitialData', undefined, (v) => {
        ObjectFilter(v, mergedFilterRules, (v.contents && currentBlock) ? postActions.concat(redirectToNext) : postActions, true)
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
    if (data.options.shorts) blockShorts(data);

    const shouldStartHook = (storageData === undefined);
    storageData = data;

    // Enable JS filtering only if function has something in it
    if (storageData.options.enable_javascript && storageData.filterData.javascript) {
      try {
        jsFilter = window.eval(storageData.filterData.javascript);
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

  function menuOnTap(event) {
    const menuAction = this.getElementsByTagName('yt-formatted-string')[0].getRawText();
    if (!['Block Channel', 'Block Video'].includes(menuAction)) {
      if (this.onTap) this.onTap(event);
      else if (this.onTap_) this.onTap_(event);
      return;
    }

    if (window.btReloadRequired) {
      window.btExports.openToast("BlockTube was updated, this tab needs to be reloaded to use this function", 5000);
      return;
    }

    let type;
    let data;
    let videoData;
    let channelData;
    const eventSink = this.parentComponent.eventSink_ || this.parentComponent.inst.eventSink_;
    const parentDom = eventSink.parentComponent;
    const parentData = parentDom.data;
    let removeParent = true;

    // Video player context menu
    if (parentDom.tagName === 'YTD-VIDEO-PRIMARY-INFO-RENDERER' || parentDom.tagName === 'YTD-WATCH-METADATA') {
      const player = document.getElementsByTagName('ytd-page-manager')[0].data.playerResponse;
      const owner = document.getElementsByTagName('ytd-video-owner-renderer')[0].data;
      const ownerUCID = owner.title.runs[0].navigationEndpoint.browseEndpoint.browseId;
      let playerUCID = player.videoDetails.channelId;
      if (playerUCID !== ownerUCID) {
        playerUCID = [playerUCID, ownerUCID];
      }
      channelData = {
        text: player.videoDetails.author,
        id: playerUCID,
      };
      videoData = {
        text: player.videoDetails.title,
        id: player.videoDetails.videoId,
      };

      removeParent = false;
    } else {
      let attrKey = parentData._btOriginalAttr;
      let searchIn = mergedFilterRules[attrKey].properties ? mergedFilterRules[attrKey].properties : mergedFilterRules[attrKey];

      channelData = {
        id: getFlattenByPath(parentData, searchIn.channelId),
        text: getFlattenByPath(parentData, searchIn.channelName),
      }

      videoData = {
        id: getFlattenByPath(parentData, searchIn.videoId),
        text: getFlattenByPath(parentData, searchIn.title),
      }
    }

    switch (menuAction) {
      case 'Block Channel': {
        type = 'channelId';
        data = channelData;
        break;
      }
      case 'Block Video': {
        type = 'videoId';
        data = videoData;
        break;
      }
      default:
        break;
    }

    if (data && type) {
      postMessage('contextBlockData', { type, info: data });
      if (removeParent) {
        if (['YTD-BACKSTAGE-POST-RENDERER', 'YTD-POST-RENDERER'].includes(parentDom.tagName)) {
          parentDom.parentNode.remove();
        }
        else if (['YTD-PLAYLIST-PANEL-VIDEO-RENDERER', 'YTD-MOVIE-RENDERER'].includes(parentDom.tagName)) {
          parentDom.remove();
        }
        else if ('YTD-COMMENT-RENDERER' === parentDom.tagName) {
          if (parentDom.parentNode.tagName === 'YTD-COMMENT-THREAD-RENDERER') {
            parentDom.parentNode.remove();
          } else {
            parentDom.remove();
          }
        }
        else {
          parentDom.dismissedRenderer = {
            notificationMultiActionRenderer: {
              responseText: {simpleText: 'Blocked'},
            }
          };
          parentDom.setAttribute('is-dismissed', '');
        }
      } else {
        document.getElementById('movie_player').stopVideo();
      }
      if (this.data.serviceEndpoint) {
        if (this.onTap) this.onTap(event);
        else if (this.onTap_) this.onTap_(event);
      }
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
    openToast,
    menuOnTap
  }
}());
