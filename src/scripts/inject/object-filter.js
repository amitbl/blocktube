window.BT_FILTER = (function (UTILS, CONSTANTS, ACTIONS, CONTEXT_MENU, STATE) {
    'use strict';
    const has = Object.prototype.hasOwnProperty;
    const { getObjectByPath, getFlattenByPath, parseTime, parseViewCount } = UTILS;
    const { REGEX_PROPS, DELETE_ALLOWED } = CONSTANTS;

    function ObjectFilter(object, filterRules, postActions = [], contextMenus = false) {
        if (!(this instanceof ObjectFilter)) {
            return new ObjectFilter(object, filterRules, postActions, contextMenus);
        }

        this.object = object;
        this.filterRules = filterRules;
        this.contextMenus = contextMenus;
        this.blockedComments = [];
        this.actions = ACTIONS;

        this.filter();
        try {
            postActions.forEach(x => {
                if (typeof this.actions[x] === 'function') {
                    this.actions[x].call(this);
                } else if (typeof x === 'function') {
                    x.call(this);
                }
            });
        } catch (e) {
            console.error("postActions Exception", e);
        }
        return this;
    }

    ObjectFilter.prototype.isDataEmpty = function () {
        const { storageData } = STATE;
        if (storageData.options.shorts || storageData.options.movies || storageData.options.mixes) return false;
        if (!isNaN(storageData.options.percent_watched_hide)) return false;

        if (!isNaN(storageData.filterData.vidLength[0]) || !isNaN(storageData.filterData.vidLength[1])) return false;

        for (let idx = 0; idx < REGEX_PROPS.length; idx += 1) {
            if (storageData.filterData[REGEX_PROPS[idx]].length > 0) return false;
        }

        return !STATE.jsFilterEnabled;
    };

    ObjectFilter.prototype.matchFilterData = function (filters, obj, objectType) {
        const friendlyVideoObj = {};
        const { storageData } = STATE;

        if (document.location.pathname === '/feed/history' && storageData.options.disable_on_history) return false;

        let doBlock = Object.keys(filters).some((h) => {
            const filterPath = filters[h];
            if (filterPath === undefined) return false;

            const properties = storageData.filterData[h];
            if (REGEX_PROPS.includes(h) && (properties === undefined || properties.length === 0 && !STATE.jsFilterEnabled)) return false;

            let value = getFlattenByPath(obj, filterPath);
            if (value === undefined) return false;

            if (h === 'percentWatched' && storageData.options.percent_watched_hide && objectType != 'playlistPanelVideoRenderer' && !['/feed/history', '/feed/library', '/playlist'].includes(document.location.pathname) && parseInt(value) >= storageData.options.percent_watched_hide) return true;

            if (REGEX_PROPS.includes(h) && properties.some(prop => prop && prop.test(value))) return true;

            if (h === 'vidLength') {
                const vidLen = parseTime(value);
                if (vidLen === -2 && storageData.options.shorts) return true;
                if (vidLen > 0 && properties.length === 2) {
                    if (storageData.options.vidLength_type === 'block') {
                        if ((properties[0] !== null && vidLen >= properties[0]) && (properties[1] !== null && vidLen <= properties[1])) return true;
                    } else {
                        if ((properties[0] !== null && vidLen < properties[0]) || (properties[1] !== null && vidLen > properties[1])) return true;
                    }
                }
                value = vidLen;
            }

            if (STATE.jsFilterEnabled) {
                if (h === 'viewCount') value = parseViewCount(value);
                else if (h === 'channelBadges' || h === 'badges') {
                    const badges = [];
                    value.forEach(br => {
                        if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_VERIFIED") badges.push("verified");
                        else if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_VERIFIED_ARTIST") badges.push("artist");
                        else if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_LIVE_NOW") badges.push("live");
                        else if (br.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_MEMBERS_ONLY") badges.push("members");
                    });
                    value = badges;
                }
                friendlyVideoObj[h] = value;
            }
            return false;
        });

        if (!doBlock && STATE.jsFilterEnabled) {
            try {
                doBlock = !!STATE.jsFilter(friendlyVideoObj, objectType);
            } catch (e) {
                console.error("Custom function exception", e, "friendlyVideoObj: ", friendlyVideoObj, "objectType: ", objectType);
            }
        }
        if (doBlock && objectType === 'commentEntityPayload') {
            this.blockedComments.push(obj.properties.commentId);
        }
        return doBlock;
    };

    ObjectFilter.prototype.isExtendedMatched = function (filteredObject, h) {
        const { storageData } = STATE;
        if (storageData.options.movies) {
            if (h === 'movieRenderer' || h === 'compactMovieRenderer') return true;
            if (h === 'videoRenderer' && !getObjectByPath(filteredObject, "shortBylineText.runs.navigationEndpoint.browseEndpoint") && filteredObject.longBylineText && filteredObject.badges) return true;
        }
        if (storageData.options.shorts && (h === 'shortsLockupViewModel' || h === 'reelItemRenderer' || h === 'gridShelfViewModel')) return true;
        if (storageData.options.mixes && (h === 'radioRenderer' || h === 'compactRadioRenderer')) return true;
        if (storageData.options.mixes && h === 'lockupViewModel') {
            let imgName = getObjectByPath(filteredObject, 'contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.icon.sources.clientResource.imageName');
            if (imgName === 'MIX') return true;
        }
        if (h === 'commentThreadRenderer' && this.blockedComments.includes(getObjectByPath(filteredObject, 'commentViewModel.commentViewModel.commentId'))) return true;
        if (h === 'commentViewModel' && this.blockedComments.includes(getObjectByPath(filteredObject, 'commentId'))) return true;
        return false;
    };

    ObjectFilter.prototype.matchFilterRule = function (obj) {
        if (this.isDataEmpty()) return [];
        return Object.keys(this.filterRules).reduce((res, h) => {
            let properties, customFunc, related;
            const filteredObject = obj[h];
            if (filteredObject) {
                const filterRule = this.filterRules[h];
                if (has.call(filterRule, 'properties')) {
                    properties = filterRule.properties;
                    customFunc = filterRule.customFunc;
                    related = filterRule.related;
                } else {
                    properties = filterRule;
                }
                if (this.isExtendedMatched(filteredObject, h) || this.matchFilterData(properties, filteredObject, h)) {
                    res.push({ name: h, customFunc, related });
                }
            }
            return res;
        }, []);
    };

    ObjectFilter.prototype.filter = function (obj = this.object) {
        let deletePrev = false;
        if (typeof obj !== 'object' || obj === null) return deletePrev;

        const matchedRules = this.matchFilterRule(obj);
        matchedRules.forEach((r) => {
            let customRet = true;
            if (r.customFunc) {
                customRet = this.actions[r.customFunc].call(this, obj, r.name);
            }
            if (customRet) {
                delete obj[r.name];
                deletePrev = r.related || true;
            }
        });

        let len = 0;
        let keys;
        if (obj instanceof Array) {
            len = obj.length;
        } else {
            keys = Object.keys(obj);
            len = keys.length;
        }

        for (let i = len - 1; i >= 0; i -= 1) {
            const idx = keys ? keys[i] : i;
            if (obj[idx] === undefined) continue;
            const childDel = this.filter(obj[idx]);
            if (childDel && keys === undefined) {
                deletePrev = true;
                obj.splice(idx, 1);
                if (typeof childDel === "string" && obj.length > 0 && obj[idx] && obj[idx][childDel]) {
                    obj.splice(idx, 1);
                }
            }
            if (obj[idx] instanceof Array && obj[idx].length === 0 && childDel) {
                deletePrev = true;
            } else if (childDel && DELETE_ALLOWED.includes(idx)) {
                delete obj[idx];
                deletePrev = true;
            }
        }

        if (this.contextMenus) CONTEXT_MENU.addContextMenus(obj, STATE);
        return deletePrev;
    };

    return { ObjectFilter };
});