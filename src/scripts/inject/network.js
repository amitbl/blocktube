window.BT_NET = (function (FILTER, RULES, ACTIONS, STATE) {
    'use strict';
    const has = Object.prototype.hasOwnProperty;
    const { ObjectFilter } = FILTER;
    const { filterRules, mergedFilterRules } = RULES;

    function fetchFilter(url, resp) {
        if (STATE.storageData === undefined) return;

        if (['/youtubei/v1/search', '/youtubei/v1/browse'].includes(url.pathname)) {
            new ObjectFilter(resp, filterRules.main, [], true);
        } else if (url.pathname === '/youtubei/v1/next') {
            const postActions = ['fixAutoPlay'];
            if (STATE.currentBlock) postActions.push('redirectToNext');
            new ObjectFilter(resp, mergedFilterRules, postActions, true);
        } else if (url.pathname === '/youtubei/v1/guide') {
            new ObjectFilter(resp, filterRules.guide, [], true);
        } else if (url.pathname === '/youtubei/v1/player') {
            new ObjectFilter(resp, filterRules.ytPlayer, ['playerMiscFilters']);
        }
    }

    function spfFilter(url, resp) {
        if (STATE.storageData === undefined) return;

        let ytDataArr = resp.part || resp.response.parts || resp.response;
        ytDataArr = (ytDataArr instanceof Array) ? ytDataArr : [ytDataArr];

        ytDataArr.forEach((obj) => {
            if (has.call(obj, 'player')) {
                try {
                    const player_resp = UTILS.getObjectByPath(obj.player, 'args.player_response');
                    obj.player.args.raw_player_response = JSON.parse(player_resp);
                } catch (e) { }
                new ObjectFilter(obj.player, filterRules.ytPlayer, ['playerMiscFilters']);
            }

            if (has.call(obj, 'playerResponse')) {
                new ObjectFilter(obj.playerResponse, filterRules.ytPlayer);
            }

            if (has.call(obj, 'response') || has.call(obj, 'data')) {
                let rules, postActions = [];
                switch (url.pathname) {
                    case '/guide_ajax': rules = filterRules.guide; break;
                    case '/comment_service_ajax': case '/live_chat/get_live_chat': rules = filterRules.comments; break;
                    case '/watch':
                        postActions = ['fixAutoPlay'];
                        if (STATE.currentBlock) postActions.push('redirectToNext');
                    default: rules = filterRules.main;
                }
                new ObjectFilter(obj.response || obj.data, rules, postActions, true);
            }
        });
    }

    return {
        fetchFilter,
        spfFilter,
    };
});