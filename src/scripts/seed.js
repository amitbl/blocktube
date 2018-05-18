// This script must be executed before any other YouTube scripts in order to function properly.
// Because of browser's caching mechanism and async behavior, this is not always the case.
// To overcome this issue, it's contents will be minifed and hardcoded into the content script on
// build, forcing browsers to execute it first.
(function () {
  'use strict';

  window.btDispatched = false;

  const hooks = {
    menuOnTap(event) {
      let data;
      let type;
      const parentDom = this.parentComponent.eventSink_.parentComponent;
      const parent = parentDom.data;
      let removeParent = true;

      // Video player context menu
      if (!parent.shortBylineText) {
        parent.shortBylineText = {
          runs: document.getElementsByTagName('ytd-video-owner-renderer')[0].data.title.runs,
        };
        parent.videoId = document.getElementsByTagName('ytd-watch')[0].videoId;
        removeParent = false;
      }

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
          document.getElementById('movie_player').destroy();
        }
      } else if (this.onTap_) {
        this.onTap_(event);
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

  function postMessage(type, data) {
    window.postMessage({ from: 'BLOCKTUBE_PAGE', type, data }, `https://${document.domain}`);
  }

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
}());
