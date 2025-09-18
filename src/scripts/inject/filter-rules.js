window.BT_RULES = (function (CONSTANTS) {
    'use strict';

    const { DATA_PATHS } = CONSTANTS;

    const baseRules = {
        videoId: DATA_PATHS.VIDEO_ID,
        channelId: DATA_PATHS.CHANNEL_ID_BROWSE,
        channelBadges: DATA_PATHS.OWNER_BADGES,
        channelName: DATA_PATHS.CHANNEL_NAME_BYLINE,
        title: DATA_PATHS.TITLE,
        vidLength: DATA_PATHS.THUMBNAIL_OVERLAYS_TIME,
        viewCount: DATA_PATHS.VIEW_COUNT_TEXT,
        badges: DATA_PATHS.BADGES,
        publishTimeText: DATA_PATHS.PUBLISHED_TIME_TEXT,
        percentWatched: DATA_PATHS.THUMBNAIL_OVERLAYS_RESUME,
    };

    const filterRules = {
        main: {
            compactMovieRenderer: {
                videoId: DATA_PATHS.VIDEO_ID,
                title: DATA_PATHS.TITLE,
                vidLength: DATA_PATHS.THUMBNAIL_OVERLAYS_TIME,
                badges: DATA_PATHS.BADGES,
                percentWatched: DATA_PATHS.THUMBNAIL_OVERLAYS_RESUME,
            },
            movieRenderer: {
                videoId: DATA_PATHS.VIDEO_ID,
                title: DATA_PATHS.TITLE,
                vidLength: DATA_PATHS.THUMBNAIL_OVERLAYS_TIME,
                badges: DATA_PATHS.BADGES,
                percentWatched: DATA_PATHS.THUMBNAIL_OVERLAYS_RESUME,
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
                channelId: DATA_PATHS.POST_AUTHOR_ID,
                channelName: DATA_PATHS.POST_AUTHOR_NAME,
            },
            backstagePostRenderer: {
                channelId: DATA_PATHS.POST_AUTHOR_ID,
                channelName: DATA_PATHS.POST_AUTHOR_NAME,
            },
            watchCardCompactVideoRenderer: {
                title: DATA_PATHS.PRIMARY_INFO_TITLE,
                channelId: DATA_PATHS.WATCH_CARD_CHANNEL_ID,
                channelName: DATA_PATHS.WATCH_CARD_CHANNEL_NAME,
                videoId: DATA_PATHS.WATCH_CARD_VIDEO_ID,
            },
            shelfRenderer: {
                channelId: DATA_PATHS.SHELF_CHANNEL_ID,
            },
            channelVideoPlayerRenderer: {
                title: DATA_PATHS.PRIMARY_INFO_TITLE,
            },
            channelRenderer: {
                properties: { ...baseRules, title: undefined },
                related: 'shelfRenderer'
            },
            playlistPanelVideoRenderer: {
                properties: baseRules,
                customFunc: 'blockPlaylistVid',
            },
            videoPrimaryInfoRenderer: {
                properties: {
                    title: DATA_PATHS.PRIMARY_INFO_TITLE,
                },
                customFunc: 'redirectToNext',
            },
            videoSecondaryInfoRenderer: {
                properties: {
                    channelId: DATA_PATHS.SECONDARY_INFO_CHANNEL_ID,
                    channelName: DATA_PATHS.SECONDARY_INFO_CHANNEL_NAME,
                },
                customFunc: 'redirectToNext',
            },
            channelMetadataRenderer: {
                properties: {
                    channelId: DATA_PATHS.CHANNEL_META_ID,
                    channelName: DATA_PATHS.CHANNEL_META_NAME,
                },
                customFunc: 'redirectToIndex',
            },
            gridChannelRenderer: {
                channelId: DATA_PATHS.GRID_CHANNEL_ID,
                channelName: DATA_PATHS.GRID_CHANNEL_NAME,
            },
            miniChannelRenderer: {
                channelId: DATA_PATHS.MINI_CHANNEL_ID,
                channelName: DATA_PATHS.GRID_CHANNEL_NAME,
            },
            guideEntryRenderer: {
                channelId: DATA_PATHS.GUIDE_CHANNEL_ID,
                channelName: DATA_PATHS.GUIDE_CHANNEL_NAME,
            },
            universalWatchCardRenderer: {
                properties: {
                    channelId: DATA_PATHS.UNIVERSAL_WATCH_CARD_CHANNEL_ID,
                    channelName: DATA_PATHS.UNIVERSAL_WATCH_CARD_CHANNEL_NAME,
                },
            },
            playlist: {
                properties: {
                    channelId: DATA_PATHS.PLAYLIST_CHANNEL_ID,
                    channelName: DATA_PATHS.PLAYLIST_CHANNEL_NAME,
                    title: DATA_PATHS.PLAYLIST_TITLE,
                },
                customFunc: 'redirectToIndex',
            },
            compactChannelRecommendationCardRenderer: {
                properties: {
                    channelId: DATA_PATHS.COMPACT_CHANNEL_REC_ID,
                    channelName: DATA_PATHS.COMPACT_CHANNEL_REC_NAME,
                },
            },
            playerOverlayAutoplayRenderer: {
                properties: {
                    videoId: DATA_PATHS.VIDEO_ID,
                    channelId: DATA_PATHS.AUTOPLAY_CHANNEL_ID,
                    channelName: DATA_PATHS.AUTOPLAY_CHANNEL_NAME,
                    title: DATA_PATHS.AUTOPLAY_TITLE,
                    publishTimeText: DATA_PATHS.PUBLISHED_TIME_TEXT,
                    vidLength: DATA_PATHS.THUMBNAIL_OVERLAYS_TIME,
                },
                customFunc: 'markAutoplay',
            },
            reelItemRenderer: {
                properties: {
                    videoId: DATA_PATHS.VIDEO_ID,
                    channelId: DATA_PATHS.REEL_CHANNEL_ID,
                    channelName: DATA_PATHS.REEL_CHANNEL_NAME,
                    title: DATA_PATHS.REEL_TITLE,
                    publishTimeText: DATA_PATHS.REEL_PUBLISH_TIME,
                }
            },
            shortsLockupViewModel: {
                properties: {
                    videoId: DATA_PATHS.SHORTS_LOCKUP_VIDEO_ID,
                    title: DATA_PATHS.SHORTS_LOCKUP_TITLE,
                    viewCount: DATA_PATHS.SHORTS_LOCKUP_VIEW_COUNT,
                }
            },
            richShelfRenderer: {
                channelId: DATA_PATHS.SHELF_CHANNEL_ID,
            },
            channelFeaturedVideoRenderer: {
                ...baseRules,
                vidLength: DATA_PATHS.CHANNEL_FEATURED_LENGTH,
            },
            videoWithContextRenderer: {
                ...baseRules,
                title: DATA_PATHS.VIDEO_WITH_CONTEXT_TITLE,
                vidLength: [DATA_PATHS.THUMBNAIL_OVERLAYS_TIME],
                viewCount: DATA_PATHS.VIDEO_WITH_CONTEXT_VIEW_COUNT,
            },
            compactChannelRenderer: {
                channelId: DATA_PATHS.COMPACT_CHANNEL_ID,
                channelName: DATA_PATHS.COMPACT_CHANNEL_NAME,
                channelBadges: DATA_PATHS.OWNER_BADGES,
            },
            lockupViewModel: {
                videoId: DATA_PATHS.LOCKUP_VIDEO_ID,
                title: DATA_PATHS.LOCKUP_TITLE,
                channelName: DATA_PATHS.LOCKUP_CHANNEL_NAME,
                vidLength: DATA_PATHS.LOCKUP_LENGTH,
                viewCount: DATA_PATHS.LOCKUP_VIEW_COUNT,
                channelId: DATA_PATHS.LOCKUP_CHANNEL_ID,
                percentWatched: DATA_PATHS.LOCKUP_PERCENT_WATCHED,
            },
            chipCloudChipRenderer: {
                channelId: DATA_PATHS.CHIP_ICON,
            },
            slimVideoMetadataSectionRenderer: {
                properties: {
                    videoId: DATA_PATHS.SLIM_VIDEO_ID,
                    title: DATA_PATHS.SLIM_TITLE,
                    channelId: DATA_PATHS.SLIM_CHANNEL_ID,
                    channelName: DATA_PATHS.SLIM_CHANNEL_NAME,
                },
                customFunc: 'redirectToNextMobile',
            },
            tabRenderer: {
                channelId: DATA_PATHS.TAB_URL,
            },
            gridShelfViewModel: {},
            richSectionRenderer: {},
        },
        ytPlayer: {
            args: {
                properties: {
                    videoId: DATA_PATHS.PLAYER_ARGS_VIDEO_ID,
                    channelId: DATA_PATHS.PLAYER_ARGS_CHANNEL_ID,
                    channelName: DATA_PATHS.PLAYER_ARGS_CHANNEL_NAME,
                    title: DATA_PATHS.PLAYER_ARGS_TITLE,
                    vidLength: DATA_PATHS.PLAYER_ARGS_LENGTH,
                },
                customFunc: 'disableEmbedPlayer',
            },
            videoDetails: {
                properties: {
                    videoId: DATA_PATHS.PLAYER_DETAILS_VIDEO_ID,
                    channelId: DATA_PATHS.PLAYER_DETAILS_CHANNEL_ID,
                    channelName: DATA_PATHS.PLAYER_DETAILS_CHANNEL_NAME,
                    title: DATA_PATHS.PLAYER_DETAILS_TITLE,
                    vidLength: DATA_PATHS.PLAYER_DETAILS_LENGTH,
                },
                customFunc: 'disablePlayer',
            },
            PLAYER_VARS: {
                properties: {
                    videoId: DATA_PATHS.PLAYER_VARS_VIDEO_ID,
                    channelId: DATA_PATHS.PLAYER_VARS_CHANNEL_ID,
                    channelName: DATA_PATHS.PLAYER_VARS_CHANNEL_NAME,
                    title: DATA_PATHS.PLAYER_VARS_TITLE,
                    vidLength: DATA_PATHS.PLAYER_VARS_LENGTH,
                },
                customFunc: 'disableEmbedPlayer'
            }
        },
        guide: {
            guideEntryRenderer: {
                properties: {
                    channelId: DATA_PATHS.GUIDE_ENTRY_CHANNEL_ID,
                    channelName: DATA_PATHS.GUIDE_ENTRY_CHANNEL_NAME,
                },
            },
            pivotBarItemRenderer: {
                channelId: DATA_PATHS.PIVOT_BAR_ITEM_ID
            },
        },
        comments: {
            commentEntityPayload: {
                channelId: DATA_PATHS.COMMENT_ENTITY_CHANNEL_ID,
                channelName: DATA_PATHS.COMMENT_ENTITY_CHANNEL_NAME,
                comment: DATA_PATHS.COMMENT_ENTITY_CONTENT,
            },
            commentThreadRenderer: {},
            commentViewModel: {},
            commentRenderer: {
                channelId: DATA_PATHS.COMMENT_RENDERER_CHANNEL_ID,
                channelName: DATA_PATHS.COMMENT_RENDERER_CHANNEL_NAME,
                comment: DATA_PATHS.COMMENT_RENDERER_CONTENT,
            },
            liveChatTextMessageRenderer: {
                channelId: DATA_PATHS.LIVE_CHAT_CHANNEL_ID,
                channelName: DATA_PATHS.LIVE_CHAT_CHANNEL_NAME,
                comment: DATA_PATHS.LIVE_CHAT_MESSAGE,
            },
        }
    };

    const mergedFilterRules = Object.assign({}, filterRules.main, filterRules.comments);

    return {
        filterRules,
        mergedFilterRules,
    };
}(window.BT_CONSTANTS));