// This script must be executed before any other YouTube scripts in order to function properly.
// Because of browser's caching mechanism and async behavior, this is not always the case.
// To overcome this issue, it's contents will be minifed and hardcoded into the content script on
// build, forcing browsers to execute it first.
(function () {
	'use strict';

	window.btDispatched = false;
	const isMobileInterface = document.location.hostname.startsWith('m.');

	function createProxyHook(path, hookKeys) {
		path = path.split('.');

		function getHandler(nextPath, enableHook) {
			return {
				get: function (target, key) {
					if (key === nextPath[0] && typeof target[key] === 'object' && target[key] !== null && !target[key].isProxy_) {
						nextPath.shift();
						target[key] = new Proxy(target[key], getHandler(nextPath, nextPath.length == 0));
						target[key].isProxy_ = true;
					}
					return target[key];
				},
				set: function (target, key, value) {
					if (enableHook && hookKeys.includes(key)) {
						function hook_() {
							if (window.btDispatched) return value.apply(null, arguments);
							else window.addEventListener('blockTubeReady', value.bind(null, arguments));
						}
						target[key] = hook_;
					} else {
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
		menuOnTapMobile(...args) {
			window.btExports.menuOnTapMobile.call(this, ...args);
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
		return function (resp) {
			if (window.btDispatched) {
				window.btExports.spfFilter(url, resp);
				next(resp);
			} else window.addEventListener('blockTubeReady', () => {
				window.btExports.spfFilter(url, resp);
				next(resp);
			});
		}
	}

	function spfRequest(cb) {
		return function (...args) {
			if (args.length < 2) return cb.apply(null, args);
			let url = new URL(args[0], document.location.origin);
			if (isUrlMatch(url)) {
				args[1].onDone = onPart(url, args[1].onDone);
				args[1].onPartDone = onPart(url, args[1].onPartDone);
			}
			return cb.apply(null, args);
		}
	}


	//////////

	// This is my attempt to make the extension work in V3. When I left it alone, the extension just plain wouldn't work. With this revision, it MOSTLY works, but we sometimes get the error this code was meant to prevent. Extra work will be needed to get it working properly. — Jupiter Liar

	let windowCheckCount = 0;
	const MAX_ATTEMPTS = 100;
	const CHECK_INTERVAL = 1000; // Interval for debounce

	let observer;
	let debounceTimeout;

	function windowCheck() {
		console.log('Checking objects...');
		const results = [];
		if (window.writeEmbed) results.push('window.writeEmbed');
		if (window.ytplayer) results.push('window.ytplayer');
		if (window.Polymer) results.push('window.Polymer');

		if (results.length > 0) {
			if (windowCheckCount === 0) {
				console.log(`Initial window check failed: ${results.join(', ')}`);
				// Attach the observer here
				startObserving();
			}
			if (windowCheckCount >= MAX_ATTEMPTS) {
				console.error('Failed to initialize after multiple attempts. We may have lost the battle, but not the war.');
				// Detach the observer if needed
				if (observer) observer.disconnect();
				return;
			}
			// Wait 500ms before allowing the next check
			setTimeout(() => {

			}, CHECK_INTERVAL);
		} else {
			console.log('We have won the war.');
			// Detach the observer if needed
			if (observer) observer.disconnect();
			checkInProgress = false;
		}
	}

	// Function to start observing mutations
	function startObserving() {
		observer = new MutationObserver(() => {
			// Only schedule a check if no check is currently in progress

			clearTimeout(debounceTimeout); // Clear any existing timeout
			debounceTimeout = setTimeout(() => {
				windowCheckCount += 1;
				windowCheck(); // Trigger check on mutation
			}, CHECK_INTERVAL);

		});
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true
		});
		console.log('MutationObserver attached.');
	}

	// Perform the initial check
	windowCheck();


	/////////////////////

	// Youtube started using vanilla "fetch" for some endpoints (search and guide for now) :\
	// I'm forced to hook that one too
	const org_fetch = window.fetch;
	window.fetch = function (resource, init = undefined) {
		if (!(resource instanceof Request) || !fetch_uris.some(u => resource.url.includes(u))) {
			return org_fetch(resource, init);
		}

		return new Promise((resolve, reject) => {
			org_fetch(resource, init = init).then(function (resp) {
				const url = new URL(resource.url);
				resp.json().then(function (jsonResp) {
					if (window.btDispatched) {
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
			get: function () {
				if (!fetch_uris.some(u => this.responseURL.includes(u))) {
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

	Object.defineProperty(window, 'loadInitialData', {
		get() {
			return this.loadInitialData_;
		},
		set(v) {
			this.loadInitialData_ = (a1) => {
				if (window.btDispatched) return v(a1);
				else window.addEventListener('blockTubeReady', v.bind(this, a1));
			}
		},
	});

	// player init has moved to window.yt.player.Application.create
	window.yt = createProxyHook('player.Application', ['create', 'createAlternate']);

	// spfjs is responsible for XHR requests
	document.addEventListener('spfready', function (e) {
		Object.defineProperty(window.spf, 'request', {
			get() {
				return this.request_;
			},
			set(v) {
				this.request_ = spfRequest(v);
			},
		});
	});

	if (isMobileInterface) {
		// Mobile Context menus hooking
		class ElementHook extends HTMLElement {
			connectedCallback() {
				this.onclick = hooks.menuOnTapMobile;
				this.ondblclick = hooks.menuOnTapMobile;
			}
		}
		class ButtonRendererHook extends ElementHook {}
		class MenuServiceItemHook extends ElementHook {}
		class MenuNavigationItemHook extends ElementHook {}
		class MenuItemHook extends ElementHook {}
		customElements.define('ytm-button-renderer', ButtonRendererHook);
		customElements.define('ytm-menu-service-item-renderer', MenuServiceItemHook);
		customElements.define('ytm-menu-navigation-item-renderer', MenuNavigationItemHook);
		customElements.define('ytm-menu-item', MenuItemHook);
	}

	if (!isMobileInterface) {
		let customElementsRegistryDefine = window.customElements.define;
		Object.defineProperty(window.customElements, "define", {
			configurable: true,
			enumerable: false,
			value: function (name, constructor) {
				if (name === 'ytd-menu-service-item-renderer') {
					let origCallback = constructor.prototype.connectedCallback;
					constructor.prototype.connectedCallback = function () {
						this.onclick = hooks.menuOnTap;
						origCallback.call(this);
					}
				}
				customElementsRegistryDefine.call(window.customElements, name, constructor);
			}
		})
	}
}());
