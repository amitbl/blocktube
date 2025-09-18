window.BT_CONTEXT_MENU = (function (UTILS, RULES, CONSTANTS) {
    'use strict';
    const has = Object.prototype.hasOwnProperty;
    const { getObjectByPath, getFlattenByPath, deepClone, postMessage } = UTILS;
    const { CONTEXT_MENU_OBJECTS } = CONSTANTS;
    const { mergedFilterRules } = RULES;

    function addContextMenus(obj, state) {
        !state.isMobileInterface ? addContextMenusDesktop(obj, state) : addContextMenusMobile(obj, state);
    }

    function addContextMenusMobile(obj, state) {
        const attr = CONTEXT_MENU_OBJECTS.find(e => has.call(obj, e));
        if (attr === undefined) return;

        const parentData = obj[attr];
        const searchIn = mergedFilterRules[attr].properties || mergedFilterRules[attr];

        const channelData = { id: getFlattenByPath(parentData, searchIn.channelId), text: getFlattenByPath(parentData, searchIn.channelName) };
        const videoData = { id: getFlattenByPath(parentData, searchIn.videoId), text: getFlattenByPath(parentData, searchIn.title) };

        if (['videoWithContextRenderer', 'compactVideoRenderer', 'movieRenderer', 'compactMovieRenderer', 'playlistVideoRenderer', 'reelItemRenderer', 'commentRenderer'].includes(attr)) {
            let items;
            if (has.call(obj[attr], 'menu')) items = getObjectByPath(obj[attr], 'menu.menuRenderer.items');
            if (has.call(obj[attr], 'actionMenu')) items = obj[attr].actionMenu.menuRenderer.items;
            else if (attr === 'commentRenderer') {
                obj[attr].actionMenu = { menuRenderer: { items: [] } };
                items = obj[attr].actionMenu.menuRenderer.items;
            }

            if (!items) return;
            const blockCh = { menuServiceItemRenderer: { _btOriginalAttr: attr, _btMenuAction: "block_channel", _btOriginalData: channelData, "text": { "runs": [{ "text": "Block Channel" }] }, "icon": { "iconType": "NOT_INTERESTED" }, "trackingParams": "Cg==", "serviceEndpoint": { "commandMetadata": { "webCommandMetadata": { "sendPost": true, "apiUrl": "data:text/plain;base64,Cg==" } }, "feedbackEndpoint": { "uiActions": { "hideEnclosingContainer": true }, "actions": [{ "replaceEnclosingAction": { "item": { "notificationMultiActionRenderer": { "responseText": { "runs": [{ "text": "Channel blocked" }], "accessibility": { "accessibilityData": { "label": "Channel blocked" } } } } } } }] } } } };
            const blockVid = { menuServiceItemRenderer: { _btOriginalAttr: attr, _btMenuAction: "block_video", _btOriginalData: videoData, "text": { "runs": [{ "text": "Block Video" }] }, "icon": { "iconType": "NOT_INTERESTED" }, "trackingParams": "Cg==", "serviceEndpoint": { "commandMetadata": { "webCommandMetadata": { "sendPost": true, "apiUrl": "data:text/plain;base64,Cg==" } }, "feedbackEndpoint": { "uiActions": { "hideEnclosingContainer": true }, "actions": [{ "replaceEnclosingAction": { "item": { "notificationMultiActionRenderer": { "responseText": { "runs": [{ "text": "Video blocked" }], "accessibility": { "accessibilityData": { "label": "Video blocked" } } } } } } }] } } } };
            if (channelData.id) items.push(blockCh);
            if (videoData.id) items.push(blockVid);
        } else if (attr === 'slimVideoMetadataSectionRenderer') {
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
                                        "text": { "runs": [{ "text": "Block Video" }] },
                                        "accessibility": { "label": "Block Video" },
                                        "accessibilityData": { "accessibilityData": { "label": "Block Video" } },
                                        "navigationEndpoint": {}
                                    }
                                }
                            }
                        },
                        {
                            "slimMetadataButtonRenderer": {
                                "button": {
                                    "buttonRenderer": {
                                        "_btOriginalData": channelData,
                                        "_btOriginalAttr": "slimVideoMetadataSectionRenderer",
                                        "_btMenuAction": "block_channel",
                                        "style": "STYLE_DEFAULT",
                                        "size": "SIZE_DEFAULT",
                                        "isDisabled": false,
                                        "text": { "runs": [{ "text": "Block Channel" }] },
                                        "accessibility": { "label": "Block Channel" },
                                        "accessibilityData": { "accessibilityData": { "label": "Block Channel" } },
                                        "navigationEndpoint": { "commandMetadata": { "webCommandMetadata": { "ignoreNavigation": true } }, "urlEndpoint": {} }
                                    }
                                }
                            }
                        }
                    ]
                }
            };
            items.splice(2, 0, mobileVideoMenu);
        }
    }

    function addContextMenusDesktop(obj, state) {
        const extracted = findAndExtractMenuItems(obj);
        if (!extracted) return;
        const { items, hasChannel, hasVideo, isLockupViewModel, attr } = extracted;
        injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, obj[attr], state.storageData);
        if (hasChannel || hasVideo) obj[attr]._btOriginalAttr = attr;
    }

    function findAndExtractMenuItems(obj) {
        const attr = CONTEXT_MENU_OBJECTS.find(e => has.call(obj, e));
        if (!attr) return null;
        const result = extractMenuItems(obj, attr);
        if (!result || !Array.isArray(result.items)) return null;
        return { ...result, attr };
    }

    function extractMenuItems(obj, attr) {
        let items = null, hasChannel = false, hasVideo = false, isLockupViewModel = false;

        if (has.call(obj[attr], 'videoActions')) {
            items = obj[attr].videoActions.menuRenderer.items;
            hasChannel = true; hasVideo = true;
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
            if (imgName !== 'MIX') { hasChannel = true; hasVideo = true; }
            isLockupViewModel = true;
        } else {
            items = extractFromGenericRenderer(obj[attr]);
            hasVideo = true;
            if (attr === 'movieRenderer' || attr === 'compactMovieRenderer' || attr === 'reelItemRenderer') hasChannel = false;
            else if (has.call(obj[attr], 'shortBylineText') && getObjectByPath(obj[attr], 'shortBylineText.runs.navigationEndpoint.browseEndpoint')) hasChannel = true;
        }
        return { items, hasChannel, hasVideo, isLockupViewModel };
    }

    function extractFromLockupViewModel(renderer) {
        const path = 'metadata.lockupMetadataViewModel.menuButton.buttonViewModel.onTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel';
        const sheetmodel = getObjectByPath(renderer, path);
        if (!sheetmodel) return null;

        const items = sheetmodel.content?.listViewModel?.listItems;
        if (!items) return null;

        const searchIn = mergedFilterRules['lockupViewModel'];
        const metadataBlock = { metadata: { channelId: getFlattenByPath(renderer, searchIn.channelId), channelName: getFlattenByPath(renderer, searchIn.channelName), videoId: getFlattenByPath(renderer, searchIn.videoId), videoName: getFlattenByPath(renderer, searchIn.title), removeObject: true } };
        Object.defineProperty(sheetmodel, 'blockTube', { value: metadataBlock, writable: true, enumerable: true, configurable: true });
        return items;
    }

    function extractFromGenericRenderer(renderer) {
        let items = getObjectByPath(renderer, 'menu.menuRenderer.items');
        const topLevel = getObjectByPath(renderer, 'menu.menuRenderer.topLevelButtons');
        if (!items) {
            if (!topLevel) renderer.menu = { menuRenderer: { items: [] } };
            else renderer.menu.menuRenderer.items = [];
            items = renderer.menu.menuRenderer.items;
        }
        return items;
    }

    function injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, currentObj, storageData) {
        if (isLockupViewModel) {
            return injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, storageData);
        }
        return injectStandardMenuButtons(items, hasChannel, hasVideo, storageData);
    }

    function injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, storageData) {
        if (!items.length) return;
        const cleanChannelContext = createCleanContext(items, storageData, true, currentObj);
        const cleanVideoContext = createCleanContext(items, storageData, false, currentObj);
        if (hasChannel) items.push(createLockupButtonItem('Block Channel', cleanChannelContext));
        if (hasVideo) items.push(createLockupButtonItem('Block Video', cleanVideoContext));
        return true;
    }

    function createCleanContext(items, storageData, isChannel, currentObj) {
        const item = isChannel ? items[6] : items[5];
        if (storageData.options.block_feedback && item) return item?.listItemViewModel?.rendererContext;
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
                                        "buttons": [],
                                        "trackingParams": "",
                                        "dismissalViewStyle": "DISMISSAL_VIEW_STYLE_COMPACT_TALL"
                                    }
                                }
                            }
                        }
                    ],
                    "contentId": currentObj.contentId
                }
            };
        }
        return cleanContext;
    }

    function createLockupButtonItem(title, rendererContext) {
        return { listItemViewModel: { title: { content: title }, leadingImage: { sources: [{ clientResource: { imageName: "NOT_INTERESTED" } }] }, rendererContext } };
    }

    function injectStandardMenuButtons(items, hasChannel, hasVideo, storageData) {
        const blockChannelItem = createStandardBlockItem('Block Channel');
        const blockVideoItem = createStandardBlockItem('Block Video');
        if (storageData.options.block_feedback) {
            for (const item of items) {
                const endpoint = item?.menuServiceItemRenderer?.serviceEndpoint;
                if (!endpoint) continue;
                const iconType = getObjectByPath(item, 'menuServiceItemRenderer.icon.iconType');
                if (iconType === 'NOT_INTERESTED' && hasVideo) blockVideoItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
                else if (iconType === 'REMOVE' && hasChannel) blockChannelItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
            }
        }
        if (hasChannel) items.push(blockChannelItem);
        if (hasVideo) items.push(blockVideoItem);
        return false;
    }

    function createStandardBlockItem(text) {
        return { menuServiceItemRenderer: { text: { runs: [{ text }] }, icon: { iconType: "NOT_INTERESTED" } } };
    }

    function getActionMenuData(context) {
        let menuAction = "", isDataFromRightHandSide = false;
        const string = context.getElementsByTagName('yt-formatted-string');
        if (string && string.length == 1) menuAction = string[0]?.getRawText() || "";
        else { isDataFromRightHandSide = true; menuAction = context.innerText || ""; }
        return { isDataFromRightHandSide, menuAction };
    }

    function getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction) {
        let channelData, videoData, removeParent = true, stopPlayer = false;
        if (parentDom.tagName === 'YTD-VIDEO-PRIMARY-INFO-RENDERER' || parentDom.tagName === 'YTD-WATCH-METADATA') {
            const pageManager = document.getElementsByTagName('ytd-page-manager')[0];
            const playerData = pageManager.data || pageManager.getCurrentData();
            const player = playerData.playerResponse, owner = (document.getElementsByTagName('ytd-video-owner-renderer')[0]).data;
            let playerUCID = player.videoDetails.channelId;
            if (playerUCID !== owner.title.runs[0].navigationEndpoint.browseEndpoint.browseId) playerUCID = [playerUCID, owner.title.runs[0].navigationEndpoint.browseEndpoint.browseId];
            channelData = { text: player.videoDetails.author, id: playerUCID };
            videoData = { text: player.videoDetails.title, id: player.videoDetails.videoId };
            removeParent = false; stopPlayer = true;
        } else if (isDataFromRightHandSide) {
            channelData = { id: parentData.blockTube?.metadata?.channelId, text: parentData.blockTube?.metadata?.channelName };
            videoData = { id: parentData.blockTube?.metadata?.videoId, text: parentData.blockTube?.metadata?.videoName };
            removeParent = false;
        } else {
            const attrKey = parentData._btOriginalAttr, searchIn = mergedFilterRules[attrKey]?.properties || mergedFilterRules[attrKey];
            channelData = { id: getFlattenByPath(parentData, searchIn.channelId), text: getFlattenByPath(parentData, searchIn.channelName) };
            videoData = { id: getFlattenByPath(parentData, searchIn.videoId), text: getFlattenByPath(parentData, searchIn.title) };
        }
        let result;
        if (menuAction === 'Block Channel') result = { type: 'channelId', data: channelData };
        else if (menuAction === 'Block Video') result = { type: 'videoId', data: videoData };
        else return null;
        return { ...result, removeParent, stopPlayer };
    }

    function getParentDomAndData(isDataFromRightHandSide, element) {
        let parentDom, parentData;
        if (isDataFromRightHandSide) {
            parentDom = element?.parentElement?.parentElement?.parentElement?.parentElement;
            if (!parentDom) return {};
            const parentDomData = parentDom.componentProps?.data;
            if (!parentDomData) return {};
            const parentDomSymbols = Object.getOwnPropertySymbols(parentDomData);
            if (parentDomSymbols.length === 0) return {};
            parentData = parentDomData[parentDomSymbols[0]]?.value;
        } else {
            const eventSink = getObjectByPath(element.parentElement?.parentElement, 'polymerController.forwarder_.eventSink') || getObjectByPath(element.parentElement, '__dataHost.eventSink_') || getObjectByPath(element.parentElement, '__dataHost.forwarder_.eventSink') || getObjectByPath(element.parentElement, '__dataHost.hostElement.inst.eventSink_');
            if (!eventSink) return {};
            parentDom = eventSink.parentComponent || eventSink.parentElement.__dataHost?.hostElement || eventSink.parentElement?.parentElement;
            parentData = parentDom?.data;
            if (!parentDom || !parentData) return {};
        }
        return { parentDom, parentData };
    }

    function removeParentHelper(parentDom) {
        if (['YTD-BACKSTAGE-POST-RENDERER', 'YTD-POST-RENDERER'].includes(parentDom.tagName)) parentDom.parentNode.remove();
        else if (['YTD-PLAYLIST-PANEL-VIDEO-RENDERER', 'YTD-MOVIE-RENDERER'].includes(parentDom.tagName)) parentDom.remove();
        else if ('YTD-COMMENT-RENDERER' === parentDom.tagName) {
            if (parentDom.parentNode.tagName === 'YTD-COMMENT-THREAD-RENDERER') parentDom.parentNode.remove();
            else parentDom.remove();
        } else {
            parentDom.dismissedRenderer = { notificationMultiActionRenderer: { responseText: { simpleText: 'Blocked' } } };
            parentDom.setAttribute('is-dismissed', '');
        }
    }

    return { addContextMenus, getActionMenuData, getBlockData, getParentDomAndData, removeParentHelper };
}(window.BT_UTILS, window.BT_RULES, window.BT_CONSTANTS));