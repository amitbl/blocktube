window.BT_ACTIONS = (function (UTILS, STATE) {
    'use strict';

    const { getObjectByPath } = UTILS;
    const has = Object.prototype.hasOwnProperty;

    function disableEmbedPlayer() {
        if (STATE.storageData.options.suggestions_only) {
            return false;
        }
        censorTitle();
        return true;
    }

    function disablePlayer(ytData) {
        if (STATE.storageData.options.suggestions_only) {
            return false;
        }
        const message = (STATE.storageData.options.block_message) || '';
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
                    reason: { simpleText: message },
                    thumbnail: { thumbnails: [{ url: '//s.ytimg.com/yts/img/meh7-vflGevej7.png', width: 140, height: 100 }] },
                    icon: { iconType: 'ERROR_OUTLINE' }
                }
            }
        };
        STATE.currentBlock = true;
    }

    function blockPlaylistVid(pl) {
        const vid = pl.playlistPanelVideoRenderer;
        const message = (STATE.storageData.options.block_message) || '';
        vid.videoId = 'undefined';
        vid.unplayableText = { simpleText: `${message}` };
        vid.thumbnail = { thumbnails: [{ url: 'https://s.ytimg.com/yts/img/meh_mini-vfl0Ugnu3.png' }] };
        delete vid.title;
        delete vid.longBylineText;
        delete vid.shortBylineText;
        delete vid.thumbnailOverlays;
    }

    function markAutoplay(obj) {
        if (STATE.isMobileInterface) {
            obj.playerOverlayAutoplayRenderer._deleted = true;
            return false;
        }
        return true;
    }

    function redirectToIndex() {
        if (STATE.storageData && STATE.storageData.options.suggestions_only) {
            return false;
        }
        if (this && this.object) this.object = undefined;
        const index = document.location.search.indexOf('&list=');
        if (index !== -1) {
            const value = document.location.search.substring(0, index);
            document.location = document.location.pathname + value;
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
        window.addEventListener('load', () => { document.title = 'YouTube'; });
    }

    function findNextVideo(object) {
        let secondaryResults = getObjectByPath(object, 'contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results');
        if (secondaryResults === undefined) return false;

        const chipSection = secondaryResults.findIndex(x => has.call(x, 'itemSectionRenderer'));
        if (chipSection !== -1) {
            secondaryResults = getObjectByPath(secondaryResults[chipSection], 'itemSectionRenderer.contents');
            if (secondaryResults === undefined) return false;
        }

        const regularVid = secondaryResults.findIndex(x => has.call(x, 'compactVideoRenderer'));
        if (regularVid > -1) {
            return secondaryResults[regularVid].compactVideoRenderer.videoId;
        } else {
            const regularVid = secondaryResults.findIndex(x => has.call(x, 'lockupViewModel'));
            return secondaryResults[regularVid].lockupViewModel.contentId;
        }
    }

    function fixAutoPlay() {
        if (!this?.object?.playerOverlays) return;
        if (STATE.isMobileInterface) return fixAutoPlayMobile.call(this);

        if (getObjectByPath(this.object, 'playerOverlays.playerOverlayRenderer.autoplay') === undefined) return;

        let autoplayOverlay = getObjectByPath(this.object, 'playerOverlays.playerOverlayRenderer.autoplay.playerOverlayAutoplayRenderer');
        if (autoplayOverlay !== undefined) return;

        let autoPlay = getObjectByPath(this.object, 'contents.twoColumnWatchNextResults.autoplay.autoplay.sets');
        if (autoPlay === undefined) return;
        autoPlay = autoPlay[0].autoplayVideo;
        if (autoPlay === undefined) return;
        try {
            const videoId = findNextVideo(this.object);
            if (videoId !== false) {
                autoPlay.videoId = videoId;
                autoPlay.watchEndpoint.videoId = videoId;
            } else {
                delete this.object.contents.twoColumnWatchNextResults.autoplay;
            }
            this.object.responseContext.webResponseContextExtensionData.webPrefetchData.navigationEndpoints = [];
        } catch (e) {
            delete this.object.contents.twoColumnWatchNextResults.autoplay;
        }
    }

    function fixAutoPlayMobile() {
        const playerOverlay = getObjectByPath(this.object, "playerOverlays.playerOverlayRenderer.autoplay.playerOverlayAutoplayRenderer");
        if (!playerOverlay._deleted) return;

        const nextResults = getObjectByPath(this.object, 'contents.singleColumnWatchNextResults.results.results.contents');
        if (!nextResults) return;

        let nextSection;
        for (const [, v] of nextResults.entries()) {
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
        STATE.currentBlock = false;
        if (STATE.storageData.options.suggestions_only) return false;

        const isPlaylist = new URL(document.location).searchParams.has('list');
        if (isPlaylist) return;

        const nextResults = getObjectByPath(this.object, 'contents.singleColumnWatchNextResults.results.results.contents');
        if (!nextResults) return;

        if (STATE.storageData.options.autoplay !== true) {
            delete this.object.contents;
            return;
        }

        let nextSection;
        for (const [, v] of nextResults.entries()) {
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
        if (STATE.isMobileInterface) return redirectToNextMobile.call(this);

        STATE.currentBlock = false;
        if (STATE.storageData.options.suggestions_only) return false;

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
        if (STATE.storageData.options.autoplay !== true) {
            secondary.secondaryResults = undefined;
            return;
        }

        const vidId = findNextVideo(this.object);
        if (vidId !== false) {
            document.location = `watch?v=${vidId}`;
        }
        secondary.secondaryResults = undefined;
    }

    return {
        disableEmbedPlayer,
        disablePlayer,
        blockPlaylistVid,
        markAutoplay,
        redirectToIndex,
        redirectToNext,
        redirectToNextMobile,
        fixAutoPlay,
        playerMiscFilters: function playerMiscFilters() {
            let start_obj = getObjectByPath(this.object, 'args.raw_player_response');
            start_obj = (start_obj) ? start_obj : this.object;

            if (STATE.storageData.options.disable_you_there === true) {
                const playerMessages = getObjectByPath(start_obj, 'messages', []);
                for (let i = playerMessages.length - 1; i >= 0; i -= 1) {
                    if (has.call(playerMessages[i], 'youThereRenderer')) {
                        playerMessages.splice(i, 1);
                    }
                }
            }

            if (STATE.storageData.options.disable_db_normalize === true) {
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
                });
            }
        },
    };
});