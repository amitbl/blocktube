// This script must be executed before any other YouTube scripts in order to function properly.
// Because of browser's caching mechanism and async behavior, this is not always the case.
// To overcome this issue, it's contents will be minifed and hardcoded into the content script on
// build, forcing browsers to execute it first.
(function () {
  'use strict';

  window.btDispatched = false;

  function createProxyHook(path, hookKeys) {
    path = path.split('.');

    function getHandler(nextPath, enableHook) {
      return {
        get: function(target, key) {
          if (key === nextPath[0] && typeof target[key] === 'object' && target[key] !== null && !target[key].isProxy_) {
            nextPath.shift();
            target[key] = new Proxy(target[key], getHandler(nextPath, nextPath.length == 0));
            target[key].isProxy_ = true;
          }
          return target[key];
        },
        set: function(target, key, value) {
          if (enableHook && hookKeys.includes(key)) {
            function hook_() {
              if (window.btDispatched) return value.apply(null, arguments);
              else window.addEventListener('blockTubeReady', value.bind(null, arguments));
            }
            target[key] = hook_;
          }
          else {
            target[key] = value;
          }
          return true;
      }
      };
    }

    return new Proxy({}, getHandler(path, path.length == 1));
  }

  // need to filter following XHR requests
  const spf_uris = [
    '/browse_ajax',
    '/related_ajax',
    '/service_ajax',
    '/list_ajax',
    '/guide_ajax',
    '/live_chat/get_live_chat',
  ];

  const fetch_uris = [
    '/youtubei/v1/search',
    '/youtubei/v1/guide',
    '/youtubei/v1/browse',
    '/youtubei/v1/next',
    '/youtubei/v1/player'
  ];

  const hooks = {
    menuOnTap(...args) {
      window.btExports.menuOnTap.call(this, ...args);
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
    return spf_uris.some(uri => uri === url.pathname) || url.searchParams.has('pbj');
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

  // Youtube started using vanilla "fetch" for some endpoints (search and guide for now) :\
  // I'm forced to hook that one too
  const org_fetch = window.fetch;
  window.fetch = function(resource, init=undefined) {
    if (!(resource instanceof Request) || !fetch_uris.some(u => resource.url.includes(u))) {
      return org_fetch(resource, init);
    }

    return new Promise((resolve, reject) => {
      org_fetch(resource, init=init).then(function(resp) {
          const url = new URL(resource.url);
          resp.json().then(function (jsonResp) {
            if(window.btDispatched) {
              window.btExports.fetchFilter(url, jsonResp);
              resolve(new Response(JSON.stringify(jsonResp)));
            } else window.addEventListener('blockTubeReady', () => {
              window.btExports.fetchFilter(url, jsonResp);
              resolve(new Response(JSON.stringify(jsonResp)));
            });
          }).catch(reject);
      }).catch(reject);
    });
  }

  if (window.location.pathname.startsWith('/embed/')) {
    const XMLHttpRequestResponse = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
    Object.defineProperty(XMLHttpRequest.prototype, 'response', {
      get: function() {
        if(!fetch_uris.some(u => this.responseURL.includes(u))) {
          return XMLHttpRequestResponse.get.call(this);
        }
        let res = JSON.parse(XMLHttpRequestResponse.get.call(this).replace(')]}\'', ''));
        window.btExports.fetchFilter(new URL(this.responseURL), res);
        return JSON.stringify(res);
      },
      configurable: true
    });
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

  // player init has moved to window.yt.player.Application.create
  window.yt = createProxyHook('player.Application', ['create', 'createAlternate']);

  // spfjs is responsible for XHR requests
  document.addEventListener('spfready', function(e) {
      Object.defineProperty(window.spf, 'request', {
        get() {
          return this.request_;
        },
        set(v) {
          this.request_ = spfRequest(v);
        },
      });
  });
}());
