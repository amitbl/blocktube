// This script must be executed before any other YouTube scripts in order to function properly.
// Because of browser's caching mechanism and async behavior, this is not always the case.
// To overcome this issue, it's contents will be minifed and hardcoded into the content script on
// build, forcing browsers to execute it first.
(function () {
  'use strict';

  window.btDispatched = false;

  // need to filter following XHR requests
  const uris = [
    '/browse_ajax',
    '/related_ajax',
    '/service_ajax',
    '/list_ajax',
    '/guide_ajax',
    '/live_chat/get_live_chat',
  ];

  const hooks = {
    menuOnTap(event) {
      const menuAction = this.getElementsByTagName('yt-formatted-string')[0].textContent;
      if (!['Block Channel', 'Block Video'].includes(menuAction)) {
        if (this.onTap_) this.onTap_(event);
        return;
      }

      let type;
      let data;
      let videoData;
      let channelData;
      const parentDom = this.parentComponent.eventSink_.parentComponent;
      const parentData = parentDom.data;
      let removeParent = true;

      // Video player context menu
      if (parentDom.tagName === 'YTD-VIDEO-PRIMARY-INFO-RENDERER') {
        const player = document.getElementsByTagName('ytd-page-manager')[0].data.player;
        const owner = document.getElementsByTagName('ytd-video-owner-renderer')[0].data;
        const ownerUCID = owner.title.runs[0].navigationEndpoint.browseEndpoint.browseId;
        let playerUCID = player.args.ucid;
        if (playerUCID !== ownerUCID) {
          playerUCID = [playerUCID, ownerUCID];
        }
        channelData = {
          text: player.args.author,
          id: playerUCID,
        };
        videoData = {
          text: player.args.title,
          id: player.args.video_id,
        };

        removeParent = false;
      } else {
        channelData = {
          text: parentData.shortBylineText.runs[0].text,
          id: parentData.shortBylineText.runs[0].navigationEndpoint.browseEndpoint.browseId,
        };
        videoData = {
          text: parentData.title.simpleText,
          id: parentData.videoId,
        };
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
          parentDom.setAttribute('is-dismissed', '');
          // TODO: Menu does not close without this timeout
          setTimeout(() => parentDom.parentElement.removeChild(parentDom), 100);
        } else {
          document.getElementById('movie_player').stopVideo();
        }
      }
    },
    genericHook(cb) {
      return function (...args) {
        if (window.btDispatched) {
          cb.call(this, ...args);
        } else {
          window.addEventListener('blockTubeReady', () => {
            cb.call(this, ...args);
          });
        }
      };
    },
  };

  function setupPolymer(v) {
    return function (...args) {
      if (!args[0].is) {
        return v(...args);
      }
      switch (args[0].is) {
        case 'ytd-app':
          args[0].loadDesktopData_ = hooks.genericHook(args[0].loadDesktopData_);
          break;
        case 'ytd-guide-renderer':
          args[0].attached = hooks.genericHook(args[0].attached);
          break;
        case 'ytd-menu-service-item-renderer':
          args[0].onTapHook_ = hooks.menuOnTap;
          args[0].listeners.tap = 'onTapHook_';
          break;
        default:
          break;
      }
      return v(...args);
    };
  }

  function isUrlMatch(url) {
    if (!(url instanceof URL)) url = new URL(url);
    return uris.some(uri => uri === url.pathname) || url.searchParams.has('pbj');
  }

  function onPart(url, next) {
    return function(resp) {
      if(window.btDispatched) {
        window.btExports.spfFilter(url, resp);
        next(resp);
      } else window.addEventListener('blockTubeReady', () => {
        window.btExports.spfFilter(url, resp);
        next(resp);
      });
    }
  }

  function spfRequest(cb) {
    return function(...args) {
      if (args.length < 2) return cb.apply(null, args);
      let url = new URL(args[0], document.location.origin);
      if (isUrlMatch(url)) {
        args[1].onDone = onPart(url, args[1].onDone);
        args[1].onPartDone = onPart(url, args[1].onPartDone);
      }
      return cb.apply(null, args);
    }
  }

  function postMessage(type, data) {
    window.postMessage({ from: 'BLOCKTUBE_PAGE', type, data }, document.location.origin);
  }

  // Start
  if (window.writeEmbed || window.ytplayer || window.Polymer) {
    console.error('We may have lost the battle, but not the war');
    return;
  }

  // Polymer elements modifications
  Object.defineProperty(window, 'Polymer', {
    get() {
      return this._polymer;
    },
    set(v) {
      if (v instanceof Function) {
        this._polymer = setupPolymer(v);
      } else {
        this._polymer = v;
      }
    },
    configurable: true,
    enumerable: true,
  });

  // writeEmbed builds the player in embed pages
  Object.defineProperty(window, 'writeEmbed', {
    get() {
      return this.writeEmbed_;
    },
    set(v) {
      this.writeEmbed_ = () => {
        if (window.btDispatched) v.apply(this);
        else window.addEventListener('blockTubeReady', v.bind(this));
      };
    },
  });

  // load builds the player in regular video pages
  window.ytplayer_ = {};
  Object.defineProperty(window, 'ytplayer', {
    get() {
      return this.ytplayer_;
    },
    set() {
    },
  });
  Object.defineProperty(window.ytplayer, 'load', {
    get() {
      return this.load_;
    },
    set(v) {
      this.load_ = () => {
        if (window.btDispatched) v.apply(this);
        else window.addEventListener('blockTubeReady', v.bind(this));
      };
    },
  });

  // spfjs is responsible for XHR requests
  window.spf = {};
  Object.defineProperty(window.spf, 'request', {
    get() {
      return this.request_;
    },
    set(v) {
      this.request_ = spfRequest(v);
    },
  });
}());
