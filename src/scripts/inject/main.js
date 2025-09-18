(function (CONSTANTS, UTILS, RULES, ACTIONS_MODULE, FILTER_MODULE, CONTEXT_MENU, NET_MODULE) {
    'use strict';
    const has = Object.prototype.hasOwnProperty;

    // Global state for the injection script
    const STATE = {
        storageData: undefined,
        jsFilter: undefined,
        jsFilterEnabled: false,
        currentBlock: false,
        isMobileInterface: document.location.hostname.startsWith('m.'),
        reloadRequired: false,
    };

    // Late-bind modules that need the state
    const ACTIONS = ACTIONS_MODULE(UTILS, STATE);
    const FILTER = FILTER_MODULE(UTILS, CONSTANTS, ACTIONS, CONTEXT_MENU, STATE);
    const NET = NET_MODULE(FILTER, RULES, ACTIONS, STATE);

    // Thanks to uBlock origin
    const defineProperty = function (chain, cValue, middleware = undefined) {
        let aborted = false;
        const mustAbort = (v) => {
            if (aborted) return true;
            aborted = (v !== undefined && v !== null) && (cValue !== undefined && cValue !== null) && (typeof v !== typeof cValue);
            return aborted;
        };
        const trapProp = (owner, prop, configurable, handler) => {
            if (handler.init(owner[prop]) === false) return;
            const odesc = Object.getOwnPropertyDescriptor(owner, prop);
            let prevGetter, prevSetter;
            if (odesc instanceof Object) {
                if (odesc.configurable === false) return;
                if (odesc.get instanceof Function) prevGetter = odesc.get;
                if (odesc.set instanceof Function) prevSetter = odesc.set;
            }
            Object.defineProperty(owner, prop, {
                configurable,
                get() { if (prevGetter) prevGetter(); return handler.getter(); },
                set(a) { if (prevSetter) prevSetter(a); handler.setter(a); },
            });
        };
        const trapChain = (owner, chain) => {
            const pos = chain.indexOf('.');
            if (pos === -1) {
                trapProp(owner, chain, true, {
                    v: undefined,
                    init: function (v) { if (mustAbort(v)) return false; this.v = v; return true; },
                    getter: function () { return cValue; },
                    setter: function (a) {
                        if (middleware) { cValue = a; middleware(a); }
                        else { if (mustAbort(a) === false) return; cValue = a; }
                    },
                });
                return;
            }
            const prop = chain.slice(0, pos);
            chain = chain.slice(pos + 1);
            trapProp(owner, prop, true, {
                v: undefined,
                init: function (v) { this.v = v; return true; },
                getter: function () { return this.v; },
                setter: function (a) { this.v = a; if (a instanceof Object) trapChain(a, chain); },
            });
        };
        trapChain(window, chain);
    }

    function transformToRegExp(data) {
        if (!has.call(data, 'filterData')) return;
        CONSTANTS.REGEX_PROPS.forEach((p) => {
            if (has.call(data.filterData, p)) {
                data.filterData[p] = data.filterData[p].map((v) => {
                    try {
                        return new RegExp(v[0], v[1].replace('g', ''));
                    } catch (e) {
                        console.error(`RegExp parsing error: /${v[0]}/${v[1]}`);
                        return undefined;
                    }
                });
            }
        });
    }

    function blockMixes(data) {
        data.filterData.channelName.push(/^YouTube$/);
    }

    function blockTrending(data) {
        if (document.location.pathname === '/feed/trending' || document.location.pathname === '/feed/explore') ACTIONS.redirectToIndex();
        data.filterData.channelId.push(/^FEtrending$/, /^FEexplore$/, /^EXPLORE_DESTINATION$/);
    }

    function blockShorts(data) {
        if (document.location.pathname.startsWith('/shorts/')) ACTIONS.redirectToIndex();
        data.filterData.channelId.push(/^TAB_SHORTS$/, /^TAB_SHORTS_CAIRO$/, /^.+\/shorts$/);
    }

    function startHook() {
        if (window.location.pathname.startsWith('/embed/')) {
            const ytConfigPlayerConfig = UTILS.getObjectByPath(window, 'yt.config_.PLAYER_VARS');
            if (typeof ytConfigPlayerConfig === 'object' && ytConfigPlayerConfig !== null) {
                try { ytConfigPlayerConfig.raw_player_response = JSON.parse(ytConfigPlayerConfig.embedded_player_response); } catch (e) { }
                new FILTER.ObjectFilter(window.yt.config_, RULES.filterRules.ytPlayer, ['playerMiscFilters']);
            } else {
                defineProperty('yt.config_', undefined, (v) => {
                    try { if (has.call(v, 'PLAYER_VARS')) v.PLAYER_VARS.raw_player_response = JSON.parse(v.PLAYER_VARS.embedded_player_response); } catch (e) { }
                    new FILTER.ObjectFilter(window.yt.config_, RULES.filterRules.ytPlayer, ['playerMiscFilters']);
                });
            }
        }

        const ytPlayerconfig = UTILS.getObjectByPath(window, 'ytplayer.config');
        if (typeof ytPlayerconfig === 'object' && ytPlayerconfig !== null) {
            new FILTER.ObjectFilter(window.ytplayer.config, RULES.filterRules.ytPlayer, ['playerMiscFilters']);
        } else {
            defineProperty('ytplayer.config', undefined, (v) => {
                if (UTILS.getObjectByPath(v, 'args.player_response')) {
                    try { v.args.raw_player_response = JSON.parse(v.args.player_response); } catch (e) { }
                }
                new FILTER.ObjectFilter(window.ytplayer.config, RULES.filterRules.ytPlayer, ['playerMiscFilters']);
            });
        }

        if (typeof window.ytInitialGuideData === 'object' && window.ytInitialGuideData !== null) new FILTER.ObjectFilter(window.ytInitialGuideData, RULES.filterRules.guide);
        else defineProperty('ytInitialGuideData', undefined, (v) => new FILTER.ObjectFilter(v, RULES.filterRules.guide));

        if (typeof window.ytInitialPlayerResponse === 'object' && window.ytInitialPlayerResponse !== null) new FILTER.ObjectFilter(window.ytInitialPlayerResponse, RULES.filterRules.ytPlayer);
        else defineProperty('ytInitialPlayerResponse', undefined, (v) => new FILTER.ObjectFilter(v, RULES.filterRules.ytPlayer));

        const postActions = ['fixAutoPlay'];
        if (typeof window.ytInitialData === 'object' && window.ytInitialData !== null) {
            new FILTER.ObjectFilter(window.ytInitialData, RULES.mergedFilterRules, (window.ytInitialData.contents && STATE.currentBlock) ? postActions.concat('redirectToNext') : postActions, true);
        } else {
            defineProperty('ytInitialData', undefined, (v) => {
                new FILTER.ObjectFilter(v, RULES.mergedFilterRules, (v.contents && STATE.currentBlock) ? postActions.concat('redirectToNext') : postActions, true);
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

        const shouldStartHook = (STATE.storageData === undefined);
        STATE.storageData = data;

        if (STATE.storageData.options.enable_javascript && STATE.storageData.filterData.javascript) {
            try {
                try {
                    if (window.trustedTypes && window.trustedTypes.createPolicy) {
                        window.trustedTypes.createPolicy('default', { createHTML: string => string, createScriptURL: string => string, createScript: string => string });
                    }
                } catch (e) { }
                STATE.jsFilter = window.eval(STATE.storageData.filterData.javascript);
                if (!(STATE.jsFilter instanceof Function)) throw Error("Function not found");
                STATE.jsFilterEnabled = STATE.storageData.options.enable_javascript;
            } catch (e) {
                console.error("Custom function syntax error", e);
                STATE.jsFilterEnabled = false;
            }
        } else {
            STATE.jsFilterEnabled = false;
        }

        if (shouldStartHook && !window.btDispatched) startHook();
    }

    function openToast(msg, duration) {
        const ytdApp = document.getElementsByTagName('ytd-app')[0];
        if (ytdApp === undefined) return;
        const detail = { actionName: 'yt-open-popup-action', args: [{ openPopupAction: { durationHintMs: duration, popup: { notificationActionRenderer: { responseText: { runs: [{ text: msg }] } } }, popupType: 'TOAST' } }, ytdApp] };
        ytdApp.dispatchEvent(new CustomEvent('yt-action', { bubbles: true, composed: true, detail }));
    }

    function menuOnTap(event) {
        if (STATE.storageData === undefined) return;
        const { isDataFromRightHandSide, menuAction } = CONTEXT_MENU.getActionMenuData(this);
        if (!['Block Channel', 'Block Video'].includes(menuAction)) {
            event.preventDefault(); return;
        }
        if (STATE.reloadRequired) { openToast("BlockTube was updated, this tab needs to be reloaded to use this function", 5000); return; }

        const { parentDom, parentData } = CONTEXT_MENU.getParentDomAndData(isDataFromRightHandSide, this);
        const blockDetails = CONTEXT_MENU.getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction);
        if (!blockDetails) return;
        const { type, data, removeParent, stopPlayer } = blockDetails;

        UTILS.postMessage('contextBlockData', { type, info: data });

        if (removeParent) CONTEXT_MENU.removeParentHelper(parentDom);
        else if (stopPlayer) document.getElementById('movie_player').stopVideo();

        if (this.data && this.data.serviceEndpoint) {
            if (this.onTap) this.onTap(event);
            else if (this.onTap_) this.onTap_(event);
        }
    }

    function menuOnTapMobile(event) {
        if (STATE.storageData === undefined) return;
        if (STATE.reloadRequired) { openToast("BlockTube was updated, this tab needs to be reloaded to use this function", 5000); return; }

        let data = UTILS.getObjectByPath(this, '__instance.props.data') || this.data;
        if (!data || !data._btOriginalData) return;

        let type;
        if (data._btMenuAction === 'block_channel') type = 'channelId';
        else if (data._btMenuAction === 'block_video') type = 'videoId';
        else return;

        UTILS.postMessage('contextBlockData', { type, info: data._btOriginalData });
        if (data._btOriginalAttr === 'slimVideoMetadataSectionRenderer') {
            document.getElementById('movie_player').stopVideo();
            alert((type === 'videoId' ? 'Video' : 'Channel') + ' Blocked');
        }
        if (data._btOriginalAttr === 'commentRenderer') {
            let comments = document.querySelector('ytm-section-list-renderer');
            STATE.storageData.filterData.channelId.push(new RegExp('^' + data._btOriginalData.id + '$'));
            new FILTER.ObjectFilter(comments.data, RULES.filterRules.comments, [], false);
        }
    }

    // !! Start
    console.info('BlockTube Init');

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data.from || event.data.from !== 'BLOCKTUBE_CONTENT') return;
        switch (event.data.type) {
            case 'storageData': storageReceived(event.data.data); break;
            case 'reloadRequired': STATE.reloadRequired = true; openToast("BlockTube was updated, Please reload this tab to reactivate it", 15000); break;
        }
    }, true);

    window.btExports = {
        spfFilter: NET.spfFilter,
        fetchFilter: NET.fetchFilter,
        openToast,
        menuOnTap,
        menuOnTapMobile
    };

}(window.BT_CONSTANTS, window.BT_UTILS, window.BT_RULES, window.BT_ACTIONS, window.BT_FILTER, window.BT_CONTEXT_MENU, window.BT_NET));