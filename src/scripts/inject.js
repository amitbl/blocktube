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
    'playlistVideoRenderer',
    'lockupViewModel',
    // Mobile
    'reelItemRenderer',
    'slimVideoMetadataSectionRenderer',
    'videoWithContextRenderer'
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
    'reelShelfRenderer',
    'richSectionRenderer'
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
      'shortBylineText',
      'longBylineText',
    ],
    title: ['title'],
    vidLength: ['thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text'],
    viewCount: [
        'viewCountText'
    ],
    badges: 'badges',
    publishTimeText: ['publishedTimeText'],
    percentWatched: 'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched'
  };

  const filterRules = {
    main: {
      compactMovieRenderer: {
        videoId: 'videoId',
        title: ['title'],
        vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
        badges: 'badges',
        percentWatched: 'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched'
      },
      movieRenderer: {
        videoId: 'videoId',
        title: ['title'],
        vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
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
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText']
      },
      backstagePostRenderer: {
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText']
      },

      watchCardCompactVideoRenderer: {
        title: 'title',
        channelId: 'subtitles.runs.navigationEndpoint.browseEndpoint.browseId',
        channelName: 'subtitles',
        videoId: 'navigationEndpoint.watchEndpoint.videoId',
      },

      shelfRenderer: {
        channelId: 'endpoint.browseEndpoint.browseId',
      },

      channelVideoPlayerRenderer: {
        title: 'title',
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
          title: 'title',
        },
        customFunc: redirectToNext,
      },

      videoSecondaryInfoRenderer: {
        properties: {
          channelId: 'owner.videoOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'owner.videoOwnerRenderer.title',
        },
        customFunc: redirectToNext,
      },

      // channel page header
      channelMetadataRenderer: {
        properties: {
          channelId: 'externalId',
          channelName: 'title',
        },
        customFunc: redirectToIndex,
      },

      // related channels
      gridChannelRenderer: {
        channelId: 'channelId',
        channelName: 'title',
      },

      miniChannelRenderer: {
        channelId: 'channelId',
        channelName: 'title',
      },

      // sidemenu subscribed channels
      guideEntryRenderer: {
        channelId: 'navigationEndpoint.browseEndpoint.browseId',
        channelName: ['title', 'formattedTitle'],
      },

      universalWatchCardRenderer: {
        properties: {
          channelId: 'header.watchCardRichHeaderRenderer.titleNavigationEndpoint.browseEndpoint.browseId',
          channelName: 'header.watchCardRichHeaderRenderer.title',
        },
      },

      playlist: {
        properties: {
          channelId: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
          channelName: ['shortBylineText'],
          title: 'title',
        },
        customFunc: redirectToIndex,
      },

      compactChannelRecommendationCardRenderer: {
        properties: {
          channelId: 'channelEndpoint.browseEndpoint.browseId',
          channelName: ['channelTitle'],
        },
      },

      playerOverlayAutoplayRenderer: {
        properties: {
          videoId: 'videoId',
          channelId: 'byline.runs.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'byline',
          title: ['videoTitle'],
          publishTimeText: 'publishedTimeText',
          vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
        },
        customFunc: markAutoplay,
      },

      reelItemRenderer: {
        properties: {
          videoId: 'videoId',
          channelId: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelNavigationEndpoint.browseEndpoint.browseId',
          channelName: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelTitleText',
          title: ['headline'],
          publishTimeText: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.timestampText'
        }
      },

      shortsLockupViewModel: {
        properties: {
          videoId: 'onTap.innertubeCommand.reelWatchEndpoint.videoId',
          title: 'overlayMetadata.primaryText.content',
          viewCount: 'overlayMetadata.secondaryText.content'
        }
      },

      richShelfRenderer: {
        channelId: 'endpoint.browseEndpoint.browseId'
      },

      channelFeaturedVideoRenderer: {
        ...baseRules,
        vidLength: 'lengthText'
      },

      videoWithContextRenderer: {
        ...baseRules,
        title: 'headline',
        vidLength: ['thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text'],
        viewCount: 'shortViewCountText',
      },

      compactChannelRenderer: {
        channelId: 'channelId',
        channelName: 'displayName',
        channelBadges: 'ownerBadges',
      },

      lockupViewModel: {
        videoId: 'contentId',
        title: 'metadata.lockupMetadataViewModel.title.content',
        channelName: 'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows.metadataParts.text.content',
        vidLength: 'contentImage.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.text',
        viewCount: 'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[1].metadataParts.text.content',
        channelId: ['metadata.lockupMetadataViewModel.image.decoratedAvatarViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId', 
                    'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows.metadataParts.text.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId'],
        percentWatched: 'contentImage.thumbnailViewModel.overlays.thumbnailBottomOverlayViewModel.progressBar.thumbnailOverlayProgressBarViewModel.startPercent'
      },

      // Mobile top chips
      chipCloudChipRenderer: {
        channelId: 'icon.iconType'
      },

      // Mobile Video page data
      slimVideoMetadataSectionRenderer: {
        properties: {
          videoId: 'videoId',
          title: 'contents.slimVideoInformationRenderer.title',
          channelId: 'contents.slimOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'contents.slimOwnerRenderer.title'
        },
        customFunc: redirectToNextMobile,
      },

      tabRenderer: {
        channelId: 'endpoint.commandMetadata.webCommandMetadata.url'
      },

      // Empty for blocking short headers
      gridShelfViewModel: {
      },

      richSectionRenderer: {
      }
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
          channelName: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.title'],
          title: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.title'],
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
          channelName: ['title', 'formattedTitle'],
        },
      },
      // Mobile buttom navigation bar
      pivotBarItemRenderer: {
          channelId: 'icon.iconType'
      },
    },
    comments: {
      commentEntityPayload: {
        channelId: ['author.channelId'],
        channelName: ['author.displayName'],
        comment: ['properties.content.content']
      },
      commentThreadRenderer: {},
      commentViewModel: {},
      commentRenderer: {
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText'],
        comment: ['contentText'],
      },
      liveChatTextMessageRenderer: {
        channelId: 'authorExternalChannelId',
        channelName: ['authorName'],
        comment: 'message',
      },
    }
  }

  const mergedFilterRules = Object.assign({}, filterRules.main, filterRules.comments);

  // !! ObjectFilter
  function ObjectFilter(object, filterRules, postActions = [], contextMenus = false) {
    if (!(this instanceof ObjectFilter))
      return new ObjectFilter(object, filterRules, postActions, contextMenus);

    this.object = object;
    this.filterRules = filterRules;
    this.contextMenus = contextMenus;
    this.blockedComments = [];

    this.filter();
    try {
      postActions.forEach(x => x.call(this));
    } catch(e) {
      console.error("postActions Exception");
      console.error(e);
    }
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

    if (document.location.pathname === '/feed/history' && storageData.options.disable_on_history) return false;

    let doBlock = Object.keys(filters).some((h) => {
      const filterPath = filters[h];
      if (filterPath === undefined) return false;

      const properties = storageData.filterData[h];
      if (regexProps.includes(h) && (properties === undefined || properties.length === 0 && !jsFilterEnabled)) return false;

      let value = getFlattenByPath(obj, filterPath);
      if (value === undefined) return false;

      if (h === 'percentWatched' && storageData.options.percent_watched_hide && objectType != 'playlistPanelVideoRenderer'
           && !['/feed/history', '/feed/library', '/playlist'].includes(document.location.pathname)
           && parseInt(value) >= storageData.options.percent_watched_hide) return true;

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
            else if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_MEMBERS_ONLY") { 
              badges.push("members"); 
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
        console.error("Custom function exception", e, "friendlyVideoObj: ", friendlyVideoObj, "objectType: ", objectType);
      }
    }
    if (doBlock && objectType === 'commentEntityPayload') {
      this.blockedComments.push(obj.properties.commentId);
    }
    return doBlock;
  };

  ObjectFilter.prototype.isExtendedMatched = function(filteredObject, h) {
    if (storageData.options.movies) {
      if (h === 'movieRenderer' || h === 'compactMovieRenderer') return true;
      if (h === 'videoRenderer' && !getObjectByPath(filteredObject, "shortBylineText.runs.navigationEndpoint.browseEndpoint") && filteredObject.longBylineText && filteredObject.badges) return true;
    }
    if (storageData.options.shorts && (h === 'shortsLockupViewModel' || h === 'reelItemRenderer' || h === 'gridShelfViewModel') ) return true;
    if (storageData.options.mixes && (h === 'radioRenderer' || h === 'compactRadioRenderer')) return true;
    if (storageData.options.mixes && h === 'lockupViewModel') {
      let imgName = getObjectByPath(filteredObject, 'contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.icon.sources.clientResource.imageName');
      if (imgName === 'MIX') {
        return true;
      }
    }

    if (h === 'commentThreadRenderer') {
      if (this.blockedComments.includes(getObjectByPath(filteredObject, 'commentViewModel.commentViewModel.commentId'))) {
        return true;
      }
    }

    if (h === 'commentViewModel') {
      if (this.blockedComments.includes(getObjectByPath(filteredObject, 'commentId'))) {
        return true;
      } 
    }

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

    if (this.contextMenus) !isMobileInterface ? addContextMenus(obj) : addContextMenusMobile(obj);
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

  function markAutoplay(obj, name) {
    if (isMobileInterface) {
      obj.playerOverlayAutoplayRenderer._deleted = true;
      return false;
    } else {
      return true;
    }
  }

  function redirectToIndex() {
    if (storageData && storageData.options.suggestions_only) {
      return false;
    }

    if (this && this.object) this.object = undefined;
    const index = document.location.search.indexOf('&list=');
    if (index !== -1) {
      const value = document.location.search.substring(0, index);
      document.location = document.location.pathname + value
    } else {
      document.location = '/';
    }
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

  function fixAutoPlayMobile() {

    const playerOverlay = getObjectByPath(this.object, "playerOverlays.playerOverlayRenderer.autoplay.playerOverlayAutoplayRenderer");
    if (!playerOverlay._deleted) return;

    const nextResults = getObjectByPath(this.object, 'contents.singleColumnWatchNextResults.results.results.contents');
    if (!nextResults) return;

    let nextSection;
    for (const [i, v] of nextResults.entries()) {
      if (has.call(v, 'itemSectionRenderer') && v.itemSectionRenderer.targetId === 'watch-next-feed') {
        nextSection = v.itemSectionRenderer;
      }
    }

    let nextVideoRenderer = getObjectByPath(nextSection, 'contents.videoWithContextRenderer');
    if (!nextVideoRenderer) return;

    playerOverlay.videoTitle = nextVideoRenderer.headline;
    playerOverlay.byline = nextVideoRenderer.shortBylineText;
    playerOverlay.background = nextVideoRenderer.thumbnail;
    playerOverlay.nextButton.buttonRenderer.navigationEndpoint = nextVideoRenderer.navigationEndpoint;
    playerOverlay.thumbnailOverlays = nextVideoRenderer.thumbnailOverlays;
    playerOverlay.videoId = nextVideoRenderer.videoId;
    playerOverlay.shortViewCountText = nextVideoRenderer.shortViewCountText;

    const autoplaySet = getObjectByPath(this.object, 'contents.singleColumnWatchNextResults.autoplay.autoplay.sets.autoplayVideo');
    if (!autoplaySet) return;

    autoplaySet.commandMetadata = nextVideoRenderer.navigationEndpoint.commandMetadata;
    autoplaySet.watchEndpoint = nextVideoRenderer.navigationEndpoint.watchEndpoint;
  }

  function redirectToNextMobile() {
    currentBlock = false;

    if (storageData.options.suggestions_only) {
      return false;
    }

    const isPlaylist = new URL(document.location).searchParams.has('list');
    if (isPlaylist) return;

    const nextResults = getObjectByPath(this.object, 'contents.singleColumnWatchNextResults.results.results.contents');
    if (!nextResults) return;

    if (storageData.options.autoplay !== true) {
      delete this.object.contents;
      return;
    }

    let nextSection;
    for (const [i, v] of nextResults.entries()) {
      if (has.call(v, 'itemSectionRenderer') && v.itemSectionRenderer.targetId === 'watch-next-feed') {
        nextSection = v.itemSectionRenderer;
      }
    }

    if (!nextSection) nextSection = nextResults;

    let nextAutoPlayObj = getObjectByPath(nextSection, 'contents.videoWithContextRenderer');
    if (!nextAutoPlayObj) return;

    document.location = `watch?v=${nextAutoPlayObj.videoId}`;
    delete this.object.contents;
  }

  function redirectToNext() {
    if (isMobileInterface) return redirectToNextMobile.call(this);

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
    if (arr.simpleText !== undefined) return arr.simpleText;
    if (!(arr.runs instanceof Array)) return arr;
    return arr.runs.reduce((res, v) => {
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

  function getObjectByPath(obj, path, def = undefined) {
    const paths = (path instanceof Array) ? path : path.split('.');
    let nextObj = obj;

    const exist = paths.every((v) => {
      // support bracket/index notation like "metadataRows[1]"
      if (/\[.*\]/.test(v)) {
        // split base name and all numeric indices like "a[1][2]"
        const parts = [];
        const baseMatch = v.match(/^([^\[]+)/);
        if (baseMatch && baseMatch[1]) parts.push(baseMatch[1]);
        const idxMatches = [...v.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1], 10));

        // navigate to base property first (if present)
        for (let p = 0; p < parts.length; p += 1) {
          const key = parts[p];
          if (!nextObj || !has.call(nextObj, key)) return false;
          nextObj = nextObj[key];
        }

        // then apply numeric indices in order
        for (let k = 0; k < idxMatches.length; k += 1) {
          const idx = idxMatches[k];
          if (!Array.isArray(nextObj) || idx < 0 || idx >= nextObj.length) return false;
          nextObj = nextObj[idx];
        }

        return true;
      }

      // segment is a plain token (no bracket)
      if (nextObj instanceof Array) {
        // when we have an array of objects, find an element that contains the key v
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
    const parts = viewCount.split(" ");
    if (parts[1] !== "views" && parts[1] !== "view") return undefined; // Fail if not english formatting
    let views = parts[0];
    
    // Handle abbreviated formats (K, M, B)
    const multipliers = {
      'K': 1000,
      'M': 1000000,
      'B': 1000000000
    };
    
    // Check if it ends with a multiplier
    const lastChar = views.slice(-1).toUpperCase();
    let multiplier = 1;
    let numericPart = views.replace(',', '');
    
    if (multipliers[lastChar]) {
      multiplier = multipliers[lastChar];
      numericPart = views.slice(0, -1); // Remove the letter
    }
    
    // Return the final count
    return (numericPart * multiplier);
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
    if (storageData === undefined) return;

    if (['/youtubei/v1/search', '/youtubei/v1/browse'].includes(url.pathname)) {
      ObjectFilter(resp, filterRules.main, [], true);
    }
    else if (url.pathname === '/youtubei/v1/next') {
      const postActions = [fixAutoplay];
      if (currentBlock) postActions.push(redirectToNext);
      ObjectFilter(resp, mergedFilterRules, postActions, true);
    }
    else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    }
    else if (url.pathname === '/youtubei/v1/player') {
      ObjectFilter(resp, filterRules.ytPlayer, [playerMiscFilters]);
    }
  }

  function spfFilter(url, resp) {
    if (storageData === undefined) return;

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
    // Mobile Explore tab
    data.filterData.channelId.push(/^EXPLORE_DESTINATION$/);
  }

  function blockShorts(data) {
    if (document.location.pathname.startsWith('/shorts/')) {
      redirectToIndex();
    }

    data.filterData.channelId.push(/^TAB_SHORTS$/);
    data.filterData.channelId.push(/^TAB_SHORTS_CAIRO$/);
    data.filterData.channelId.push(/^.+\/shorts$/);
  }

  function fixAutoplay() {
    if (!this?.object?.playerOverlays) return;
    if (isMobileInterface) return fixAutoPlayMobile.call(this);

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
    if (regularVid > -1) {
      const vidObj = secondaryResults[regularVid].compactVideoRenderer;
      return vidObj.videoId;
    } else {
      const regularVid = secondaryResults.findIndex(x => has.call(x, 'lockupViewModel'));
      const vidObj = secondaryResults[regularVid].lockupViewModel;
      return vidObj.contentId;
    }
  }

  function addContextMenusMobile(obj) {
    const attr = contextMenuObjects.find(e => has.call(obj, e));
    if (attr === undefined) return;

    const parentData = obj[attr];
    const attrKey = attr;
    const searchIn = mergedFilterRules[attrKey].properties ? mergedFilterRules[attrKey].properties : mergedFilterRules[attrKey];

    const channelData = {
      id: getFlattenByPath(parentData, searchIn.channelId),
      text: getFlattenByPath(parentData, searchIn.channelName),
    }

    const videoData = {
      id: getFlattenByPath(parentData, searchIn.videoId),
      text: getFlattenByPath(parentData, searchIn.title),
    }

    if (['videoWithContextRenderer', 'compactVideoRenderer', 'movieRenderer', 'compactMovieRenderer', 'playlistVideoRenderer', 'reelItemRenderer', 'commentRenderer'].includes(attr)) { // Mobile Up Next videos
      let items;
      if (has.call(obj[attr], 'menu')) {
        items = getObjectByPath(obj[attr], 'menu.menuRenderer.items');
      }
      if (has.call(obj[attr], 'actionMenu')) {
        items = obj[attr].actionMenu.menuRenderer.items;
      } else if (attr === 'commentRenderer') {
        obj[attr].actionMenu = {menuRenderer: {items: [] } };
        items = obj[attr].actionMenu.menuRenderer.items;
      }

      if(!items) return;
      const blockCh = { menuServiceItemRenderer: { _btOriginalAttr: attr, _btMenuAction: "block_channel", _btOriginalData: channelData, "text": { "runs": [ { "text": "Block Channel" } ]},
        "icon": {
          "iconType": "NOT_INTERESTED"
        },
        "trackingParams": "Cg==",
        "serviceEndpoint": {
        "commandMetadata": {
          "webCommandMetadata": {
            "sendPost": true,
            "apiUrl": "data:text/plain;base64,Cg=="
          }
        },
        "feedbackEndpoint": {
          "uiActions": {
            "hideEnclosingContainer": true
          },
          "actions": [
            {
              "replaceEnclosingAction": {
                "item": {
                  "notificationMultiActionRenderer": {
                    "responseText": {
                      "runs": [
                        {
                          "text": "Channel blocked"
                        }
                      ],
                      "accessibility": {
                        "accessibilityData": {
                          "label": "Channel blocked"
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      } } };
      const blockVid = { menuServiceItemRenderer: { _btOriginalAttr: attr, _btMenuAction: "block_video", _btOriginalData: videoData, "text": { "runs": [ { "text": "Block Video" } ]},
        "icon": {
          "iconType": "NOT_INTERESTED"
        },
        "trackingParams": "Cg==",
        "serviceEndpoint": {
        "commandMetadata": {
          "webCommandMetadata": {
            "sendPost": true,
            "apiUrl": "data:text/plain;base64,Cg=="
          }
        },
        "feedbackEndpoint": {
          "uiActions": {
            "hideEnclosingContainer": true
          },
          "actions": [
            {
              "replaceEnclosingAction": {
                "item": {
                  "notificationMultiActionRenderer": {
                    "responseText": {
                      "runs": [
                        {
                          "text": "Video blocked"
                        }
                      ],
                      "accessibility": {
                        "accessibilityData": {
                          "label": "Video blocked"
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      } } };
      if (channelData.id) items.push(blockCh);
      if (videoData.id) items.push(blockVid);
    } else if (attr === 'slimVideoMetadataSectionRenderer') { // Mobile Video page
      let items = obj[attr].contents;
      if (!items) return;
      let mobileVideoMenu = {
        "slimVideoActionBarRenderer": {
          "buttons": [
            {
              "slimMetadataButtonRenderer": {
                "button": {
                  "buttonRenderer": {
                    "_btOriginalData": videoData,
                    "_btOriginalAttr": "slimVideoMetadataSectionRenderer",
                    "_btMenuAction": "block_video",
                    "style": "STYLE_DEFAULT",
                    "size": "SIZE_DEFAULT",
                    "isDisabled": false,
                    "text": {
                      "runs": [
                        {
                          "text": "Block Video"
                        }
                      ]
                    },
                    "accessibility": {
                      "label": "Block Video"
                    },
                    "accessibilityData": {
                      "accessibilityData": {
                        "label": "Block Video"
                      }
                    },
                    "navigationEndpoint": {}
                  }
                }
              }
            },
            {
              "slimMetadataButtonRenderer":  {
                "button": {
                  "buttonRenderer": {
                    "_btOriginalData": channelData,
                    "_btOriginalAttr": "slimVideoMetadataSectionRenderer",
                    "_btMenuAction": "block_channel",
                    "style": "STYLE_DEFAULT",
                    "size": "SIZE_DEFAULT",
                    "isDisabled": false,
                    "text": {
                      "runs": [
                        {
                          "text": "Block Channel"
                        }
                      ]
                    },
                    "accessibility": {
                      "label": "Block Channel"
                    },
                    "accessibilityData": {
                      "accessibilityData": {
                        "label": "Block Channel"
                      }
                    },
                    "navigationEndpoint": {"commandMetadata": {"webCommandMetadata": {"ignoreNavigation": true}}, "urlEndpoint": {}}
                  }
                }
              }
            }
          ],
          "overflowMenuText": {
            "runs": [
              {
                "text": "More"
              }
            ]
          },
          "overflowAccessibilityData": {
            "label": "More"
          }
        }
      }
      items.splice(2, 0, mobileVideoMenu);
    }
  }

  function extractMenuItems(obj, attr) {
    const has = Object.prototype.hasOwnProperty;

    let items = null;
    let hasChannel = false;
    let hasVideo = false;
    let isLockupViewModel = false;

    if (has.call(obj[attr], 'videoActions')) {
      items = obj[attr].videoActions.menuRenderer.items;
      hasChannel = true;
      hasVideo = true;
    } else if (has.call(obj[attr], 'actionMenu')) {
      items = obj[attr].actionMenu.menuRenderer.items;
      hasChannel = true;
    } else if (attr === 'commentRenderer') {
      obj[attr].actionMenu = { menuRenderer: { items: [] } };
      items = obj[attr].actionMenu.menuRenderer.items;
      hasChannel = true;
    } else if (attr === 'lockupViewModel') {
      items = extractFromLockupViewModel(obj[attr]);
      if (!items) return null;
      let imgName = getObjectByPath(obj[attr], 'contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.icon.sources.clientResource.imageName');
      if (imgName !== 'MIX') {
          hasChannel = true;
          hasVideo = true;
      }

      isLockupViewModel = true;
    } else {
      items = extractFromGenericRenderer(obj[attr]);
      hasVideo = true;

      // Determine channel presence
      if (attr === 'movieRenderer' || attr === 'compactMovieRenderer' || attr === 'reelItemRenderer') {
        hasChannel = false;
      } else if (
        has.call(obj[attr], 'shortBylineText') &&
        getObjectByPath(obj[attr], 'shortBylineText.runs.navigationEndpoint.browseEndpoint')
      ) {
        hasChannel = true;
      }
    }

    return { items, hasChannel, hasVideo, isLockupViewModel };
  }

  // Specific extractor for lockupViewModel
  function extractFromLockupViewModel(renderer) {
    const path = 'metadata.lockupMetadataViewModel.menuButton.buttonViewModel.onTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel';
    const sheetmodel = getObjectByPath(renderer, path);
    if (!sheetmodel) return null;

    const items = sheetmodel.content?.listViewModel?.listItems;
    if (!items) return null;

    const searchIn = mergedFilterRules['lockupViewModel'];
    const channelId = getFlattenByPath(renderer, searchIn.channelId);
    const channelName = getFlattenByPath(renderer, searchIn.channelName);
    const videoId = getFlattenByPath(renderer, searchIn.videoId);
    const videoName = getFlattenByPath(renderer, searchIn.title);

    const metadataBlock = { metadata: { 
      channelId, 
      channelName, 
      videoId, 
      videoName, 
      removeObject: true
    } };

    Object.defineProperty(sheetmodel, 'blockTube', {
      value: metadataBlock,
      writable: true,
      enumerable: true,
      configurable: true
    });

    return items;
  }

  // Generic fallback for renderers with menu.menuRenderer.items
  function extractFromGenericRenderer(renderer) {
    let items = getObjectByPath(renderer, 'menu.menuRenderer.items');
    const topLevel = getObjectByPath(renderer, 'menu.menuRenderer.topLevelButtons');

    if (!items) {
      if (!topLevel) {
        renderer.menu = { menuRenderer: { items: [] } };
      } else {
        renderer.menu.menuRenderer.items = [];
      }
      items = renderer.menu.menuRenderer.items;
    }

    return items;
  }

  function findAndExtractMenuItems(obj) {
    const attr = contextMenuObjects.find(e => Object.prototype.hasOwnProperty.call(obj, e));
    if (!attr) return null;

    const result = extractMenuItems(obj, attr);
    if (!result || !Array.isArray(result.items)) return null;

    return { ...result, attr };
  }

  function injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, currentObj, storageData) {
    if (isLockupViewModel) {
      return injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj,  storageData);
    } else {
      return injectStandardMenuButtons(items, hasChannel, hasVideo, storageData);
    }
  }

  function injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, storageData) {
    if (!items.length) return;

    const cleanChannelContext = createCleanContext(items, storageData, true, currentObj);
    const cleanVideoContext = createCleanContext(items, storageData, false, currentObj);

    const blockChannelItem = createLockupButtonItem('Block Channel', cleanChannelContext);
    const blockVideoItem = createLockupButtonItem('Block Video', cleanVideoContext);

    if (hasChannel) items.push(blockChannelItem);
    if (hasVideo) items.push(blockVideoItem);

    return true;
  }

  function createCleanContext(items, storageData, isChannel, currentObj) {
    const item = isChannel ? items[6] : items[5];
    if (storageData.options.block_feedback && item) {
        return item?.listItemViewModel?.rendererContext;
    }

    const baseContext = items[0]?.listItemViewModel?.rendererContext;
    if (!baseContext) return null;
  
    const msg = isChannel ? 'Channel Blocked' : 'Video Blocked';
    const cleanContext = deepClone(baseContext);
  
    if (cleanContext.commandContext?.onTap) {
      let onTap = cleanContext.commandContext?.onTap;
      onTap.innertubeCommand = {
        "clickTrackingParams": "",
        "commandMetadata": {
          "webCommandMetadata": {
            "sendPost": false,
            "apiUrl": ""
          }
        },
        "feedbackEndpoint": {
          "feedbackToken": "",
          "uiActions": {
            "hideEnclosingContainer": true
          },
          "actions": [
            {
              "clickTrackingParams": "",
              "replaceEnclosingAction": {
                "item": {
                  "notificationMultiActionRenderer": {
                    "responseText": {
                      "accessibility": {
                        "accessibilityData": {
                          "label": msg
                        }
                      },
                      "simpleText": msg
                    },
                    "buttons": [
                    ],
                    "trackingParams": "",
                    "dismissalViewStyle": "DISMISSAL_VIEW_STYLE_COMPACT_TALL"
                  }
                }
              }
            }
          ],
          "contentId": currentObj.contentId
        }
      }
    }

    return cleanContext;
  }

  function createLockupButtonItem(title, rendererContext) {
    const item = {
      listItemViewModel: {
        title: { content: title },
        leadingImage: {
          sources: [{ clientResource: { imageName: "NOT_INTERESTED" } }]
        },
        rendererContext
      }
    };

    return item;
  }

  function injectStandardMenuButtons(items, hasChannel, hasVideo, storageData) {
    const blockChannelItem = createStandardBlockItem('Block Channel');
    const blockVideoItem = createStandardBlockItem('Block Video');

    if (storageData.options.block_feedback) {
      for (const item of items) {
        const endpoint = item?.menuServiceItemRenderer?.serviceEndpoint;
        if (!endpoint) continue;

        const iconType = getObjectByPath(item, 'menuServiceItemRenderer.icon.iconType');
        if (iconType === 'NOT_INTERESTED' && hasVideo) {
          blockVideoItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
        } else if (iconType === 'REMOVE' && hasChannel) {
          blockChannelItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
        }
      }
    }

    if (hasChannel) items.push(blockChannelItem);
    if (hasVideo) items.push(blockVideoItem);

    return false;
  }

  function createStandardBlockItem(text) {
    return {
      menuServiceItemRenderer: {
        text: { runs: [{ text }] },
        icon: { iconType: "NOT_INTERESTED" }
      }
    };
  }

  function deepClone(obj) {
    // Simple deep clone (for plain objects, no functions/cycles)
    return JSON.parse(JSON.stringify(obj));
  }

  function addContextMenus(obj) {
    const extracted = findAndExtractMenuItems(obj);
    if (!extracted) return;

    const { items, hasChannel, hasVideo, isLockupViewModel, attr } = extracted;

    injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, obj[attr], storageData);

    // Attach metadata only if needed
    if (hasChannel || hasVideo) {
      obj[attr]._btOriginalAttr = attr;
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
    if (data === undefined) {
      window.btDispatched = true;
      window.dispatchEvent(new Event('blockTubeReady'));
      return;
    }
    transformToRegExp(data);
    if (data.options.trending) blockTrending(data);
    if (data.options.mixes) blockMixes(data);
    if (data.options.shorts) blockShorts(data);

    const shouldStartHook = (storageData === undefined);
    storageData = data;

    // Enable JS filtering only if function has something in it
    if (storageData.options.enable_javascript && storageData.filterData.javascript) {
      try {
        try {
          if (window.trustedTypes && window.trustedTypes.createPolicy) {
            window.trustedTypes.createPolicy('default', {
              createHTML: string => string,
              createScriptURL: string => string,
              createScript: string => string,
            });
          }
        } catch (e) {}
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

    if (shouldStartHook && !window.btDispatched) {
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

  function menuOnTapMobile(event) {
    if (storageData === undefined) return;

    if (window.btReloadRequired) {
      window.btExports.openToast("BlockTube was updated, this tab needs to be reloaded to use this function", 5000);
      return;
    }

    let data = getObjectByPath(this, '__instance.props.data') || this.data;
    if (!data || !data._btOriginalData) {
      return;
    }

    let type;
    switch (data._btMenuAction) {
      case 'block_channel': {
        type = 'channelId';
        break;
      }
      case 'block_video': {
        type = 'videoId';
        break;
      }
      default:
        return;
    }

    postMessage('contextBlockData', { type, info: data._btOriginalData });
    if (data._btOriginalAttr === 'slimVideoMetadataSectionRenderer') {
      document.getElementById('movie_player').stopVideo();
      alert( (type === 'videoId' ? 'Video' : 'Channel') + ' Blocked');
    }
    if (data._btOriginalAttr === 'commentRenderer') {
      let comments = document.querySelector('ytm-section-list-renderer')
      storageData.filterData.channelId.push(RegExp('^' + data._btOriginalData.id + '$'));
      ObjectFilter(comments.data, filterRules.comments, [], false);
    }
  }

  function getActionMenuData(context) {
    let menuAction = "";
    let isDataFromRightHandSide = false;

    const string = context.getElementsByTagName('yt-formatted-string');

    if (string && string.length == 1) {
        menuAction = string[0]?.getRawText() || "";
    } else {
      isDataFromRightHandSide = true;
      menuAction = context.innerText || "";
    }

    return { isDataFromRightHandSide, menuAction };
  }

  function getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction) {
    let channelData, videoData;
    let removeParent = true;
    let stopPlayer = false;

    // Video player context menu
    if (parentDom.tagName === 'YTD-VIDEO-PRIMARY-INFO-RENDERER' || parentDom.tagName === 'YTD-WATCH-METADATA') {
      const pageManager = document.getElementsByTagName('ytd-page-manager')[0];
      const playerData = pageManager.data || pageManager.getCurrentData();
      const player = playerData.playerResponse;

      const ownerRenderer = document.getElementsByTagName('ytd-video-owner-renderer')[0];
      const owner = ownerRenderer.data || ownerRenderer.getCurrentData();

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
      stopPlayer = true;
    } else if (isDataFromRightHandSide) {
      channelData = {
        id: parentData.blockTube?.metadata?.channelId,
        text: parentData.blockTube?.metadata?.channelName,
      };

      videoData = {
        id: parentData.blockTube?.metadata?.videoId,
        text: parentData.blockTube?.metadata?.videoName,
      };

      removeParent = false
      stopPlayer = false
    } else {
      const attrKey = parentData._btOriginalAttr;
      const searchIn = mergedFilterRules[attrKey]?.properties || mergedFilterRules[attrKey];

      channelData = {
        id: getFlattenByPath(parentData, searchIn.channelId),
        text: getFlattenByPath(parentData, searchIn.channelName),
      };

      videoData = {
        id: getFlattenByPath(parentData, searchIn.videoId),
        text: getFlattenByPath(parentData, searchIn.title),
      };
    }

    let result;
    switch (menuAction) {
      case 'Block Channel':
        result = { type: 'channelId', data: channelData };
        break;
      case 'Block Video':
        result = { type: 'videoId', data: videoData };
        break;
      default:
        return null;
    }

    return {
      ...result,
      removeParent,
      stopPlayer
    };
  }

  function getParentDomAndData(isDataFromRightHandSide, element) {
    let parentDom;
    let parentData;

    if (isDataFromRightHandSide) {
      // Traverse 4 levels up to find the parent DOM
      parentDom = element?.parentElement?.parentElement?.parentElement?.parentElement;

      if (!parentDom) {
        console.warn('Could not find parentDom in recommended data context');
        return {};
      }

      const parentDomData = parentDom.componentProps?.data;
      if (!parentDomData) {
        console.warn('Could not find componentProps.data');
        return {};
      }

      const parentDomSymbols = Object.getOwnPropertySymbols(parentDomData);
      if (parentDomSymbols.length === 0) {
        console.warn('No symbols found in parentDomData');
        return {};
      }

      parentData = parentDomData[parentDomSymbols[0]]?.value;
    } else {
      // Try to find eventSink in multiple paths without using intermediate variable
      const eventSink =
        getObjectByPath(element.parentElement?.parentElement, 'polymerController.forwarder_.eventSink') ||
        getObjectByPath(element.parentElement, '__dataHost.eventSink_') ||
        getObjectByPath(element.parentElement, '__dataHost.forwarder_.eventSink') ||
        getObjectByPath(element.parentElement, '__dataHost.hostElement.inst.eventSink_');

      if (!eventSink) {
        console.warn('Could not find eventSink in any expected path');
        return {};
      }

      parentDom = eventSink.parentComponent || eventSink.parentElement.__dataHost?.hostElement || eventSink.parentElement?.parentElement;
      parentData = parentDom?.data;

      if (!parentDom || !parentData) {
        console.warn('Failed to extract parentDom or parentData');
        return {};
      }
    }

    return { parentDom, parentData };
  }

  function removeParentHelper(isDataFromRightHandSide, parentDom) {
    if (['YTD-BACKSTAGE-POST-RENDERER', 'YTD-POST-RENDERER'].includes(parentDom.tagName)) {
      parentDom.parentNode.remove();
    } else if (['YTD-PLAYLIST-PANEL-VIDEO-RENDERER', 'YTD-MOVIE-RENDERER'].includes(parentDom.tagName)) {
      parentDom.remove();
    } else if ('YTD-COMMENT-RENDERER' === parentDom.tagName) {
      if (parentDom.parentNode.tagName === 'YTD-COMMENT-THREAD-RENDERER') {
        parentDom.parentNode.remove();
      } else {
        parentDom.remove();
      }
    } else {
      parentDom.dismissedRenderer = {
        notificationMultiActionRenderer: {
          responseText: {simpleText: 'Blocked'},
        }
      };
      parentDom.setAttribute('is-dismissed', '');
    }
  }

  function menuOnTap(event) {
    if (storageData === undefined) return;

    const { isDataFromRightHandSide, menuAction } = getActionMenuData(this);

    if (!['Block Channel', 'Block Video'].includes(menuAction)) {
      event.preventDefault();
      return;
    }

    if (window.btReloadRequired) {
      window.btExports.openToast("BlockTube was updated, this tab needs to be reloaded to use this function", 5000);
      return;
    }

    // Get the parent dom and data from this
    const {parentDom, parentData} = getParentDomAndData(isDataFromRightHandSide, this);

    // Get the data and type which is used for blocking the video
    const {type, data, removeParent, stopPlayer} = getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction)

    // Notify system what data should be added to the block list
    postMessage('contextBlockData', { type, info: data });

    if (removeParent) {
      // Remove correct component based on parentDom
      removeParentHelper(isDataFromRightHandSide, parentDom)
    } else if (stopPlayer) {
      document.getElementById('movie_player').stopVideo();
    }

    if (this.data.serviceEndpoint) {
      if (this.onTap) this.onTap(event);
      else if (this.onTap_) this.onTap_(event);
    }
  }

  // !! Start
  console.info('BlockTube Init');

  const isMobileInterface = document.location.hostname.startsWith('m.');

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
    menuOnTap,
    menuOnTapMobile
  }
}());
