window.BT_CONSTANTS = {
    // Abstraction for YouTube's internal data paths to reduce fragility.
    // When YouTube updates, only these constants should need changes.
    DATA_PATHS: {
        // Common
        VIDEO_ID: 'videoId',
        TITLE: ['title'],
        CHANNEL_ID_BROWSE: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
        CHANNEL_NAME_BYLINE: ['shortBylineText', 'longBylineText'],
        THUMBNAIL_OVERLAYS_TIME: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
        THUMBNAIL_OVERLAYS_RESUME: 'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched',
        OWNER_BADGES: 'ownerBadges',
        BADGES: 'badges',
        VIEW_COUNT_TEXT: ['viewCountText'],
        PUBLISHED_TIME_TEXT: ['publishedTimeText'],

        // Post/BackstagePost
        POST_AUTHOR_ID: 'authorEndpoint.browseEndpoint.browseId',
        POST_AUTHOR_NAME: ['authorText'],

        // Watch Card
        WATCH_CARD_VIDEO_ID: 'navigationEndpoint.watchEndpoint.videoId',
        WATCH_CARD_CHANNEL_ID: 'subtitles.runs.navigationEndpoint.browseEndpoint.browseId',
        WATCH_CARD_CHANNEL_NAME: 'subtitles',

        // Shelf
        SHELF_CHANNEL_ID: 'endpoint.browseEndpoint.browseId',

        // Video Info Renderers
        PRIMARY_INFO_TITLE: 'title',
        SECONDARY_INFO_CHANNEL_ID: 'owner.videoOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
        SECONDARY_INFO_CHANNEL_NAME: 'owner.videoOwnerRenderer.title',

        // Channel Metadata
        CHANNEL_META_ID: 'externalId',
        CHANNEL_META_NAME: 'title',

        // Grid/Mini Channel
        GRID_CHANNEL_ID: 'channelId',
        GRID_CHANNEL_NAME: 'title',
        MINI_CHANNEL_ID: 'channelId',

        // Guide Entry
        GUIDE_CHANNEL_ID: 'navigationEndpoint.browseEndpoint.browseId',
        GUIDE_CHANNEL_NAME: ['title', 'formattedTitle'],

        // Universal Watch Card
        UNIVERSAL_WATCH_CARD_CHANNEL_ID: 'header.watchCardRichHeaderRenderer.titleNavigationEndpoint.browseEndpoint.browseId',
        UNIVERSAL_WATCH_CARD_CHANNEL_NAME: 'header.watchCardRichHeaderRenderer.title',

        // Playlist
        PLAYLIST_CHANNEL_ID: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
        PLAYLIST_CHANNEL_NAME: ['shortBylineText'],
        PLAYLIST_TITLE: 'title',

        // Compact Channel Recommendation
        COMPACT_CHANNEL_REC_ID: 'channelEndpoint.browseEndpoint.browseId',
        COMPACT_CHANNEL_REC_NAME: ['channelTitle'],

        // Autoplay Overlay
        AUTOPLAY_CHANNEL_ID: 'byline.runs.navigationEndpoint.browseEndpoint.browseId',
        AUTOPLAY_CHANNEL_NAME: 'byline',
        AUTOPLAY_TITLE: ['videoTitle'],

        // Reel Item (Shorts)
        REEL_CHANNEL_ID: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelNavigationEndpoint.browseEndpoint.browseId',
        REEL_CHANNEL_NAME: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelTitleText',
        REEL_TITLE: ['headline'],
        REEL_PUBLISH_TIME: 'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.timestampText',

        // Shorts Lockup View Model
        SHORTS_LOCKUP_VIDEO_ID: 'onTap.innertubeCommand.reelWatchEndpoint.videoId',
        SHORTS_LOCKUP_TITLE: 'overlayMetadata.primaryText.content',
        SHORTS_LOCKUP_VIEW_COUNT: 'overlayMetadata.secondaryText.content',

        // Channel Featured Video
        CHANNEL_FEATURED_LENGTH: 'lengthText',

        // Video with Context
        VIDEO_WITH_CONTEXT_TITLE: 'headline',
        VIDEO_WITH_CONTEXT_VIEW_COUNT: 'shortViewCountText',

        // Compact Channel
        COMPACT_CHANNEL_ID: 'channelId',
        COMPACT_CHANNEL_NAME: 'displayName',

        // Lockup View Model
        LOCKUP_VIDEO_ID: 'contentId',
        LOCKUP_TITLE: 'metadata.lockupMetadataViewModel.title.content',
        LOCKUP_CHANNEL_NAME: 'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows.metadataParts.text.content',
        LOCKUP_LENGTH: 'contentImage.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.text',
        LOCKUP_VIEW_COUNT: 'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[1].metadataParts.text.content',
        LOCKUP_CHANNEL_ID: ['metadata.lockupMetadataViewModel.image.decoratedAvatarViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId',
            'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows.metadataParts.text.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId'],
        LOCKUP_PERCENT_WATCHED: 'contentImage.thumbnailViewModel.overlays.thumbnailBottomOverlayViewModel.progressBar.thumbnailOverlayProgressBarViewModel.startPercent',

        // Mobile Top Chips
        CHIP_ICON: 'icon.iconType',

        // Mobile Slim Video
        SLIM_VIDEO_ID: 'videoId',
        SLIM_TITLE: 'contents.slimVideoInformationRenderer.title',
        SLIM_CHANNEL_ID: 'contents.slimOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
        SLIM_CHANNEL_NAME: 'contents.slimOwnerRenderer.title',

        // Tab Renderer
        TAB_URL: 'endpoint.commandMetadata.webCommandMetadata.url',

        // Player Args
        PLAYER_ARGS_VIDEO_ID: ['video_id', 'raw_player_response.videoDetails.videoId'],
        PLAYER_ARGS_CHANNEL_ID: ['ucid', 'raw_player_response.videoDetails.channelId'],
        PLAYER_ARGS_CHANNEL_NAME: ['author', 'raw_player_response.videoDetails.author'],
        PLAYER_ARGS_TITLE: ['title', 'raw_player_response.videoDetails.title'],
        PLAYER_ARGS_LENGTH: ['length_seconds', 'raw_player_response.videoDetails.lengthSeconds'],

        // Player Video Details
        PLAYER_DETAILS_VIDEO_ID: 'videoId',
        PLAYER_DETAILS_CHANNEL_ID: 'channelId',
        PLAYER_DETAILS_CHANNEL_NAME: 'author',
        PLAYER_DETAILS_TITLE: 'title',
        PLAYER_DETAILS_LENGTH: 'lengthSeconds',

        // Player Vars (Embed)
        PLAYER_VARS_VIDEO_ID: ['video_id'],
        PLAYER_VARS_CHANNEL_ID: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.subscribeButton.subscribeButtonRenderer.channelId'],
        PLAYER_VARS_CHANNEL_NAME: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.title'],
        PLAYER_VARS_TITLE: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.title'],
        PLAYER_VARS_LENGTH: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDurationSeconds'],

        // Guide
        GUIDE_ENTRY_CHANNEL_ID: ['navigationEndpoint.browseEndpoint.browseId', 'icon.iconType'],
        GUIDE_ENTRY_CHANNEL_NAME: ['title', 'formattedTitle'],
        PIVOT_BAR_ITEM_ID: 'icon.iconType',

        // Comments
        COMMENT_ENTITY_CHANNEL_ID: ['author.channelId'],
        COMMENT_ENTITY_CHANNEL_NAME: ['author.displayName'],
        COMMENT_ENTITY_CONTENT: ['properties.content.content'],
        COMMENT_RENDERER_CHANNEL_ID: 'authorEndpoint.browseEndpoint.browseId',
        COMMENT_RENDERER_CHANNEL_NAME: ['authorText'],
        COMMENT_RENDERER_CONTENT: ['contentText'],
        LIVE_CHAT_CHANNEL_ID: 'authorExternalChannelId',
        LIVE_CHAT_CHANNEL_NAME: ['authorName'],
        LIVE_CHAT_MESSAGE: 'message',
    },

    CONTEXT_MENU_OBJECTS: [
        'backstagePostRenderer',
        'postRenderer',
        'movieRenderer',
        'compactMovieRenderer',
        'videoRenderer',
        'gridVideoRenderer',
        'compactVideoRenderer',
        'videoPrimaryInfoRenderer',
        'commentRenderer',
        'playlistPanelVideoRenderer',
        'playlistVideoRenderer',
        'lockupViewModel',
        // Mobile
        'reelItemRenderer',
        'slimVideoMetadataSectionRenderer',
        'videoWithContextRenderer',
    ],

    DELETE_ALLOWED: [
        'richItemRenderer',
        'content',
        'horizontalListRenderer',
        'verticalListRenderer',
        'shelfRenderer',
        'richShelfRenderer',
        'gridRenderer',
        'expandedShelfContentsRenderer',
        'comment',
        'commentThreadRenderer',
        'reelShelfRenderer',
        'richSectionRenderer',
    ],

    REGEX_PROPS: [
        'videoId',
        'channelId',
        'channelName',
        'title',
        'comment',
    ],
};