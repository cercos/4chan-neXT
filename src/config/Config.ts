import userCss from './user.css';
import banners from './banners.json';
import meta from '../../package.json';

const Config = {
  main: {
    'Miscellaneous': {
      'JSON Index': [
        true,
        'Replace the original board index with one supporting searching, sorting, infinite scrolling, and a catalog mode.'
      ],
      [`Use ${meta.name} Catalog`]: [
        true,
        `Link to ${meta.name}'s catalog instead of the native 4chan one.`,
        1
      ],
      'Index Refresh Notifications': [
        false,
        'Show a notice at the top of the page when the index is refreshed.',
        1
      ],
      'Follow Cursor': [
        true,
        'Image Hover and Quote Preview move with the mouse cursor.'
      ],
      'Settings Descriptions as Tooltips': [
        false,
        'Show setting descriptions as browser tooltips instead of inline text.'
      ],
      'Open Threads in New Tab': [
        false,
        `Make links to threads in the index / ${meta.name} catalog open in a new tab.`
      ],
      'External Catalog': [
        false,
        'Link to external catalog instead of the internal one.'
      ],
      'Catalog Links': [
        false,
        'Add toggle link in header menu to turn Navigation links into links to each board\'s catalog.'
      ],
      'Announcement Hiding': [
        true,
        'Add button to hide 4chan announcements.'
      ],
      'Desktop Notifications': [
        true,
        `Enables desktop notifications across various ${meta.name} features.`
      ],
      '404 Redirect': [
        true,
        'Redirect dead threads and images to the archives.'
      ],
      'Archive Report': [
        true,
        'Enable reporting posts to supported archives.'
      ],
      'Exempt Archives from Encryption': [
        false,
        'Permit loading content from, and warningless redirects to, HTTP-only archives from HTTPS pages.'
      ],
      'Keybinds': [
        true,
        'Bind actions to keyboard shortcuts.'
      ],
      'Time Formatting': [
        true,
        'Localize and format timestamps. Has more options on the "Advanced" tab.'
      ],
      'Relative Post Dates': [
        false,
        'Display dates like "3 minutes ago". Tooltip shows the timestamp.'
      ],
      'Relative Date Title': [
        false,
        'Show Relative Post Date only when hovering over dates.',
        1
      ],
      'Comment Expansion': [
        true,
        'Expand comments that are too long to display on the index. Not applicable with JSON Index.'
      ],
      'File Info Formatting': [
        true,
        'Reformat the file information.'
      ],
      'Thread Expansion': [
        true,
        'Add buttons to expand threads.'
      ],
      'Index Navigation': [
        false,
        'Add buttons to navigate between threads.'
      ],
      'Reply Navigation': [
        false,
        'Add buttons to navigate to top / bottom of thread.'
      ],
      'Unique ID and Capcode Navigation': [
        false,
        'Add buttons to navigate to posts having the same unique ID or capcode.'
      ],
      'Custom Board Titles': [
        true,
        'Allow editing of the board title and subtitle by ctrl/\u2318+clicking them.'
      ],
      'Persistent Custom Board Titles': [
        false,
        'Force custom board titles to be persistent, even if the board titles are updated.',
        1
      ],
      'Show Updated Notifications': [
        true,
        `Show notifications when ${meta.name} is successfully updated.`
      ],
      'Color User IDs': [
        true,
        'Assign unique colors to user IDs on boards that use them'
      ],
      'Count Posts by ID': [
        true,
        'Display number of posts in the thread when hovering over an ID.'
      ],
      'Remove Spoilers': [
        false,
        'Remove all spoilers in text.'
      ],
      'Reveal Spoilers': [
        false,
        'Indicate spoilers if Remove Spoilers is enabled, or make the text appear hovered if Remove Spoiler is disabled.'
      ],
      'Normalize URL': [
        true,
        'Rewrite the URL of the current page, removing slugs and excess slashes, and changing /res/ to /thread/.'
      ],
      'Disable Autoplaying Sounds': [
        false,
        'Prevent sounds on the page from autoplaying.'
      ],
      'Disable Native Extension': [
        true,
        `${meta.name} is NOT designed to work with the native extension.`
      ],
      'Enable Native Flash Embedding': [
        true,
        'Activate the native extension\'s Flash embedding if the native extension is disabled.'
      ],
      'Scroll Markers': [
        true,
        'Mark your posts and replies to them on the scroll bar.'
      ],
    },

    'Linkification': {
      'Linkify': [
        true,
        'Convert text into links where applicable.'
      ],
      'Link Title': [
        true,
        'Replace the link of a supported site with its actual title.',
        1
      ],
      'Link Title in the catalog': [
        false,
        'Replace the link of a supported site with its actual title in the catalog too. ' +
          'Speed up performance for boards that have many embeds (e.g /vt/) if turned off',
        2
      ],
      'Cover Preview': [
        true,
        'Show preview of supported links on hover.',
        1
      ],
      'Embedding': [
        true,
        'Embed supported services. Note: Some services don\'t work on HTTPS.',
        1
      ],
      'Auto-embed': [
        false,
        'Auto-embed Linkify Embeds.',
        2
      ],
      'Floating Embeds': [
        false,
        'Embed content in a frame that remains in place when the page is scrolled.',
        2
      ],
      'Convert X to xcancel': [
        false,
        'Rewrite twitter.com / x.com links to xcancel.com so clicks open the privacy front-end instead.',
        1
      ],
      'Convert YouTube to yewtu.be': [
        false,
        'Rewrite youtube.com / youtu.be links to yewtu.be so clicks open the privacy front-end instead.',
        1
      ],
    },

    'Filtering': {
      'Anonymize': [
        false,
        'Make everyone Anonymous.'
      ],
      'Filter': [
        true,
        'Self-moderation placebo.'
      ],
      'Filtered Backlinks': [
        false,
        'When enabled, shows backlinks to filtered posts with a line-through decoration. Otherwise, hides the backlinks.',
        1
      ],
      'Filter in Native Catalog': [
        true,
        'Apply 4chan X filters in native catalog.',
        1
      ],
      'MD5 Quick Filter Notifications': [
        true,
        'Show notification when quick filtering MD5s using the button or keybind.',
        1
      ],
      'MD5 Quick Filter in the Catalog': [
        true,
        'Quick filter by MD5 when clicking a thumbnail in the catalog and holding Shift. Disabling falls back on just hiding the thread.',
        1
      ],
      'MD5 Quick Filter in Threads': [
        true,
        'Quick filter by MD5 when clicking a thumbnail in a thread while holding shift.',
        1
      ],
      'Recursive Hiding': [
        true,
        'Hide replies of hidden posts, recursively.'
      ],
      'Thread Hiding Buttons': [
        true,
        'Add buttons to hide entire threads.'
      ],
      'Reply Hiding Buttons': [
        true,
        'Add buttons to hide single replies.'
      ],
      'Stubs': [
        true,
        'Show stubs of hidden threads / replies.'
      ],
      'Filter Reason': [
        true,
        'Show the reason the post was hidden in the stub. If disabled, you can hover over the stub to see the reason.'
      ],
      'Show Threads With Yous': [
        false,
        'Show hidden threads on the index/catalog when they have unread replies quoting you. They re-hide once the (You) is read.'
      ],
      'Group Hidden Threads By Filter': [
        false,
        'When showing hidden threads in catalog mode, group them under a header for the filter rule that hid them, with a separate "Manually hidden" section.'
      ],
    },

    'Images and Videos': {
      'Image Expansion': [
        true,
        'Expand images / videos.'
      ],
      'Image Hover': [
        true,
        'Show full image / video on mouseover.'
      ],
      'Image Hover in Catalog': [
        true,
        `Show full image / video on mouseover in ${meta.name} catalog.`
      ],
      'Gallery': [
        true,
        'Adds a simple and cute image gallery. Has more options in the gallery menu.'
      ],
      'Download All Media': [
        true,
        'Adds a header shortcut and menu entry to download all images/videos in the current thread/index.'
      ],
      'Persistent Download Media': [
        false,
        'Keep the "Download all media" dialog open across page loads.',
        1
      ],
      'Fullscreen Gallery': [
        false,
        'Open gallery in fullscreen mode.',
        1
      ],
      'PDF in Gallery': [
        false,
        'Show PDF files in gallery.',
        1
      ],
      'Sauce': [
        true,
        'Add sauce links to images.'
      ],
      'WEBM Metadata': [
        true,
        'Add link to fetch title metadata from webm videos.'
      ],
      'Video Duration Badge': [
        false,
        'Show a video length badge on webm/mp4 thumbnails. Reads each video\'s metadata ' +
          '(lazily, as thumbnails scroll into view), so it uses a little extra bandwidth.'
      ],
      'Reveal Spoiler Thumbnails': [
        false,
        'Replace spoiler thumbnails with the original image.'
      ],
      'Replace Thumbnails': [
        false,
        'Replace thumbnails with full-size media inline. Will degrade performance.'
      ],
      'Replace GIF': [
        false,
        'Replace gif thumbnails with the actual image.',
        1
      ],
      'Replace JPG': [
        false,
        'Replace jpg thumbnails with the actual image.',
        1
      ],
      'Replace PNG': [
        false,
        'Replace png thumbnails with the actual image.',
        1
      ],
      'Replace WEBM': [
        false,
        'Replace webm, mp4, and ogv thumbnails with the actual video. Probably will degrade browser performance ;)',
        1
      ],
      'Image Prefetching': [
        true,
        'Add a shortcut icon to the header to turn on image preloading.'
      ],
      'Fappe Tyme': [
        true,
        'Hide posts without images when header menu item is checked. *hint* *hint*'
      ],
      'Werk Tyme': [
        true,
        'Hide all post images when header menu item is checked.'
      ],
      'Autoplay': [
        true,
        'Videos begin playing immediately when opened.'
      ],
      'Restart when Opened': [
        false,
        'Restart GIFs and WebMs when you hover over or expand them.'
      ],
      'Show Controls': [
        true,
        'Show controls on videos expanded inline.'
      ],
      'Click Passthrough': [
        false,
        'Clicks on videos trigger your browser\'s default behavior. Videos can be contracted with button / dragging to the left.',
        1
      ],
      'Allow Sound': [
        true,
        'Open videos with the sound unmuted.'
      ],
      'Mouse Wheel Volume': [
        true,
        'Adjust volume of videos with the mouse wheel over the thumbnail/filename/gallery.'
      ],
      'Loop in New Tab': [
        true,
        'Loop videos opened in their own tabs.'
      ],
      'Volume in New Tab': [
        true,
        `Apply ${meta.name} mute and volume settings to videos opened in their own tabs.`
      ],
      'Enable sound posts': [
        true,
        'Enable loading audio from [sound=] file names. This audio is fetched from third parties.'
      ],
    },

    'Menu': {
      'Menu': [
        true,
        'Add a drop-down menu to posts.'
      ],
      'Report Link': [
        true,
        'Add a report link to the menu.',
        1
      ],
      'Copy Text Link': [
        true,
        'Add a link to copy the post\'s text.',
        1
      ],
      'Thread Hiding Link': [
        true,
        'Add a link to hide entire threads.',
        1
      ],
      'Reply Hiding Link': [
        true,
        'Add a link to hide single replies.',
        1
      ],
      'Delete Link': [
        true,
        'Add post and image deletion links to the menu.',
        1
      ],
      'Archive Link': [
        true,
        'Add an archive link to the menu.',
        1
      ],
      'Edit Link': [
        true,
        'Add a link to edit the image in Tegaki, /i/\'s painting program. Requires Quick Reply.',
        1
      ],
      'Download Link': [
        false,
        'Add a download with original filename link to the menu.',
        1
      ]
    },

    'Monitoring': {
      'Thread Updater': [
        true,
        'Fetch and insert new replies. Quick toggles in the header menu; more options in Threads & Posts → Updater & Cooldown; sounds in Advanced → Thread updater sound.'
      ],
      'Unread Count': [
        true,
        'Show the unread posts count in the tab title.'
      ],
      'Quoted Title': [
        false,
        'Change the page title to reflect you\'ve been quoted.',
        1
      ],
      'Hide Unread Count at (0)': [
        false,
        'Hide the unread posts count in the tab title when it reaches 0.',
        1
      ],
      'Unread Favicon': [
        true,
        'Show a different favicon when there are unread posts.'
      ],
      'Unread Line': [
        true,
        'Show a line to distinguish read posts from unread ones.'
      ],
      'Remember Last Read Post': [
        true,
        'Remember how far you\'ve read after you close the thread.'
      ],
      'Scroll to Last Read Post': [
        true,
        'Scroll back to the last read post when reopening a thread.',
        1
      ],
      'Unread Line in Index': [
        false,
        'Show a line between read and unread posts in threads in the index.',
        1
      ],
      'Remove Thread Excerpt': [
        false,
        'Replace the excerpt of the thread in the tab title with the board title.'
      ],
      'Thread Stats': [
        true,
        'Display reply and image count.'
      ],
      'IP Count in Stats': [
        true,
        'Display the unique IP count in the thread stats.',
        1
      ],
      'Page Count in Stats': [
        true,
        'Display the page count in the thread stats.',
        1
      ],
      'Purge Position': [
        false,
        'Update stats more often and add purge position when a thread is close to getting purged, for anons who manage general threads.',
        2
      ],
      'Updater and Stats in Header': [
        true,
        'Places the thread updater and thread stats in the header instead of floating them.'
      ],
      'Thread Watcher': [
        true,
        'Bookmark threads. Has more options in the thread watcher menu.'
      ],
      'Fixed Thread Watcher': [
        true,
        'Makes the thread watcher scroll with the page.',
        1
      ],
      'Persistent Thread Watcher': [
        false,
        'The thread watcher will be visible when the page is loaded.',
        1
      ],
      'Thread Watcher Attach Controls': [
        true,
        'Show the Thread Watcher titlebar button for attaching/detaching it to Quick Reply. When disabled, the attach button and Attach Location menu are hidden.',
        1
      ],
      'Mark New IPs': [
        false,
        'Label each post from a new IP with the thread\'s current IP count.'
      ],
      'Reply Pruning': [
        true,
        'Add option in header menu to hide old replies in long threads. Activated by default in stickies.'
      ],
      'Prune All Threads': [
        false,
        'Activate Reply Pruning by default in all threads.',
        1
      ],
      'Detailed Thread Stats': [
        true,
        'Display page / purge position and unique IP count in the thread stats.',
        1
      ],
      'Scrollbar Markers': [
        true,
        'Show colored markers along the right edge of the page for tracked posts. Uses the highlight colors from the Style settings.'
      ],
      'Scrollbar Mark Own Posts': [
        true,
        'Mark your own posts in the scrollbar.',
        1
      ],
      'Scrollbar Mark Quotes You': [
        true,
        'Mark posts that quote you in the scrollbar.',
        1
      ],
      'Scrollbar Mark Ghost Posts': [
        true,
        'Mark deleted (ghost) posts in the scrollbar.',
        1
      ],
      'Scrollbar Mark Unread Line': [
        true,
        'Mark the unread line position in the scrollbar.',
        1
      ],
      'Scrollbar Marker Position': [
        'offset',
        'Where markers are drawn: beside the scrollbar (single or 3 columns) or over the scrollbar (single or 3 columns). Over modes require overlay (floating) scrollbars.',
        1
      ],
      'Scrollbar Marker Hover Preview': [
        true,
        'Show a post preview when hovering a scrollbar marker. Turn off if the scrollbar makes markers hard to hover (e.g. the Over modes on Firefox).',
        1
      ]
    },

    'Posting and Captchas': {
      'Quick Reply': [
        true,
        'All-in-one form to reply, create threads, automate dumping and more.'
      ],
      'Persistent QR': [
        false,
        'The Quick reply won\'t disappear after posting.',
        1
      ],
      'Auto Hide QR': [
        true,
        'Automatically hide the quick reply when posting.',
        2
      ],
      'Open Post in New Tab': [
        true,
        'Open new threads in a new tab, and open replies in a new tab if you\'re not already in the thread.',
        1
      ],
      'Remember QR Size': [
        false,
        'Remember the size of the Quick reply.',
        1
      ],
      'Remember Spoiler': [
        false,
        'Remember the spoiler state, instead of resetting after posting.',
        1
      ],
      'Clear Name and Options After Posting': [
        false,
        'Clear the name and options (email) fields after posting and don\'t remember them across sessions. Subject and comment always clear regardless. An "always" persona still overrides this.',
        1
      ],
      'Auto-close Tags': [
        true,
        'Auto-insert matching closing tags in Quick Reply for board-supported tags like [code], [spoiler], [math], and [sjis].',
        1
      ],
      'QR Drafts': [
        false,
        'Auto-save your Quick Reply per thread, including attachments up to ~100 MB. Dead-thread drafts auto-clear from the discard bin after a day.',
        1
      ],
      'Show QR Drafts Icon': [
        true,
        'Show the drafts icon in the Quick Reply. Turn off to declutter and use the "Toggle drafts" keybind instead.',
        2
      ],
      'Allow Browser Autofill': [
        false,
        'Allow browser/password-manager suggestions for Quick Reply text fields.',
        1
      ],
      'Dump List Remove File First': [
        true,
        'Dump-list Remove clears the file before removing the queued post.',
        1
      ],
      'Randomize Filename': [
        false,
        'Set the filename to a random timestamp within the past year. Disabled on /f/.',
        1
      ],
      'Show New Thread Option in Threads': [
        true,
        'Show the option to post a new / different thread from inside a thread.',
        1
      ],
      'Hide Original Post Form': [
        true,
        'Hide the native board-index post form until you open Original Form or Start a Thread.',
        1
      ],
      'Show Upload Progress': [
        true,
        'Track progress of file uploads as percentage in submit button.',
        1
      ],
      'Cooldown': [
        true,
        'Indicate the remaining time before posting again.',
        1
      ],
      'Posting Success Notifications': [
        true,
        'Show notifications on successful post creation or file uploading.',
        1
      ],
      'Auto-load captcha': [
        false,
        'Automatically load the captcha in the QR even if your post is empty.',
        1
      ],
      'Post on Captcha Completion': [
        false,
        'Submit the post immediately when the captcha is completed.',
        1
      ],
      'Avoid OffscreenCanvas': [
        false,
        'Do not use OffscreenCanvas when converting images, workaround for ' +
          '<a href="https://github.com/TuxedoTako/4chan-xt/issues/132">this LibreWolf bug</a>',
        1
      ],
      'Auto-process Images': [
        true,
        'Automatically convert unsupported image formats and resize oversized image uploads in Quick Reply.',
        1
      ],
      'Strip Video Audio': [
        true,
        'Remove audio from MP4 and WebM uploads in Quick Reply on boards that do not allow audio.',
        1
      ],
      'Comment Preview': [
        false,
        'Live preview of how your comment will render. Shows as a draggable floating window; the arrow in its header docks it inline as a literal post in the thread (and back).',
        1
      ],
      'Comment Preview Default Mode': [
        'attached',
        'Choose where the comment preview starts when Quick Reply opens.',
        2
      ],
      'Comment Preview Attach Location': [
        'auto',
        'Where the attached floating preview docks to Quick Reply. Auto prefers bottom, but avoids the Thread Watcher when it is already attached there.',
        2
      ],
      'Comment Preview Remember Float Position': [
        false,
        'Remember a manually dragged floating preview position when Quick Reply is closed and reopened.',
        2
      ],
      'Comment Preview Thread Behavior': [
        'normal',
        'Preview behavior in threads.',
        2
      ],
      'Comment Preview Catalog Behavior': [
        'normal',
        'Preview behavior on catalog/index/archive.',
        2
      ],
      'Show Comment Preview Header Icon': [
        true,
        'Show the comment preview toggle icon in the Quick Reply titlebar.',
        2
      ],
      'Force Noscript Captcha': [
        false,
        'Use the non-Javascript fallback captcha even if Javascript is enabled.'
      ],
      'Stacked TCaptcha': [
        false,
        'Show 4chan\'s TCaptcha as a stacked image grid in Quick Reply instead of the default slider/next UI.'
      ],
      'Pass Link': [
        false,
        'Add a 4chan Pass login link to the bottom of the page.'
      ]
    },

    'Quote Links': {
      'Quote Backlinks': [
        true,
        'Add quote backlinks.'
      ],
      'OP Backlinks': [
        true,
        'Add backlinks to the OP.',
        1
      ],
      'Bottom Backlinks': [
        false,
        'Place backlinks at the bottom of posts.',
        1
      ],
      'Quote Inlining': [
        true,
        'Inline quoted post on click.'
      ],
      'Inline Cross-thread Quotes Only': [
        false,
        'Don\'t inline quote links when the posts are visible in the thread.',
        1
      ],
      'Quote Hash Navigation': [
        false,
        'Include an extra link after quotes for autoscrolling to quoted posts.',
        1
      ],
      'Forward Hiding': [
        true,
        'Hide original posts of inlined backlinks.',
        1
      ],
      'Quote Previewing': [
        true,
        'Show quoted post on hover.'
      ],
      'Quote Highlighting': [
        true,
        'Highlight the previewed post.',
        1
      ],
      'Resurrect Quotes': [
        true,
        'Link dead quotes to the archives, and support inlining/previewing of archive links like quote links.'
      ],
      'Fetch Ghost Posts': [
        false,
        'Fetch deleted posts from the configured archive and insert them inline.',
        1
      ],
      'Remember Your Posts': [
        true,
        'Remember your posting history.'
      ],
      'Mark Quotes of You': [
        true,
        'Add \'(You)\' to quotes linking to your posts.',
        1
      ],
      'Highlight Posts Quoting You': [
        true,
        'Highlights any posts that contain a quote to your post.',
        1
      ],
      'Highlight Own Posts': [
        true,
        'Highlights own posts.',
        1
      ],
      'Highlight Ghost Posts': [
        true,
        'Highlights deleted posts that have been restored from an archive.',
        1
      ],
      'Mark OP Quotes': [
        true,
        'Add \'(OP)\' to OP quotes.'
      ],
      'Mark Cross-thread Quotes': [
        true,
        'Add \'(Cross-thread)\' to cross-threads quotes.'
      ],
      'Quote Threading': [
        true,
        'Add option in header menu to thread conversations.'
      ]
    }
  },

  imageExpansion: {
    'Fit width': [
      true,
      ''
    ],
    'Fit height': [
      false,
      ''
    ],
    'Scroll into view': [
      true,
      'Scroll down when expanding images to bring the full image into view.'
    ],
    'Expand spoilers': [
      true,
      'Expand all images along with spoilers.'
    ],
    'Expand videos': [
      true,
      'Expand all images also expands videos.'
    ],
    'Expand from here': [
      false,
      'Expand all images only from current position to thread end.'
    ],
    'Expand thread only': [
      false,
      'In index, expand all images only within the current thread.'
    ],
    'Advance on contract': [
      false,
      'Advance to next post when contracting an expanded image.'
    ]
  },

  gallery: {
    'Hide Thumbnails': [
      false
    ],
    'Fit Width': [ // 'Fit width' (lowercase W) belongs to Image Expansion. Engine limitations, heh.
      true
    ],
    'Fit Height': [
      true
    ],
    'Stretch to Fit': [
      false
    ],
    'Scroll to Post': [
      true
    ],
    'Grid Thumbnails': [
      false,
      'Lay gallery thumbnails out in a grid instead of a single column.'
    ],
    'Gallery Columns': [
      3,
      'Number of thumbnail columns to show in grid mode. Columns stop being added once the strip would exceed 75% of the screen width. 0 disables the image preview and shows fullscreen thumbnails (click a thumbnail to open it in a lightbox).'
    ],
    'Gallery Thumbnails Position': [
      'right',
      'Which edge of the gallery the thumbnail strip docks to: top, bottom, left or right.'
    ],
    'Slide Delay': [
      6.0
    ]
  },

  'Default Volume': 1.0,
  'Thread Watcher Thumbnail Size': 40,
  'Thread Watcher Thumbnail Preview Size': 20,
  'Thread Watcher Max Height': 210,
  'Thread Watcher Max Width': 250,
  'Thread Watcher Sort': 'manual',
  'Thread Watcher Sort 2': '',
  'Thread Watcher Attach Controls': true,
  'Thread Watcher Attached': false,
  'Thread Watcher Attach Location': 'bottom',
  'Thread Title': 'excerpt',
  'Unread Title Count': 'always',
  'Icon Set': 'fontAwesome',
  'Comment Preview Position': 'thread', // deprecated/unused: preview is always floating + on-demand inline
  'Comment Preview Default Mode': 'attached', // 'attached' | 'inline' | 'remember'
  'Comment Preview Last Mode': 'attached', // internal state for Default Mode = remember
  'Comment Preview Attach Location': 'auto', // 'auto' | 'bottom' | 'top' | 'right' | 'left'
  'Comment Preview Inline Behavior': 'scroll', // 'scroll' = dock at thread end + scroll to it; 'inplace' = insert near viewport and follow scroll
  'Comment Preview Remember Float Position': false,
  'Comment Preview Float Position': {}, // internal state: { left: string, top: string }
  'Comment Preview Thread Behavior': 'normal', // 'normal' | 'until-content' | 'manual' — thread view only
  'Comment Preview Catalog Behavior': 'normal', // 'normal' | 'until-content' | 'manual' — non-thread (catalog/index/archive) only
  'Show Comment Preview Header Icon': true,
  'Spoiler Mode': 'default',
  'Settings Menu Layout': 'vertical',

  threadWatcher: {
    'Current Board': [
      false,
      'Only show watched threads from the current board.'
    ],
    'Auto Update Thread Watcher': [
      true,
      'Periodically check status of watched threads.'
    ],
    'Auto Watch': [
      true,
      'Automatically watch threads you start.'
    ],
    'Auto Watch Reply': [
      true,
      'Automatically watch threads you reply to.'
    ],
    'Auto Prune': [
      false,
      'Automatically remove dead threads.'
    ],
    'Show Page': [
      true,
      'Show what page watched threads are on.'
    ],
    'Show Unread Count': [
      true,
      'Show number of unread posts in watched threads.'
    ],
    'Show Mark All Read Icon': [
      true,
      'Show the mark-all-read icon in the thread watcher header.'
    ],
    'Show Mark Thread Read Icons': [
      false,
      'Show a per-thread mark-as-read icon in each watched thread entry.'
    ],
    'Show Undo Button': [
      false,
      'After "Mark all read", the watcher icon briefly becomes an Undo button with a countdown ring. Click it within a few seconds to restore.'
    ],
    'Show Site Prefix': [
      true,
      'When multiple sites are shown in the thread watcher, add a prefix to board names to distinguish them.'
    ],
    'Show OP Thumbnails': [
      false,
      'Show OP thumbnails in watched thread entries.'
    ],
    'Thread Watcher Thumbnail Hover': [
      false,
      'Show a larger OP thumbnail preview when hovering watched-thread thumbnails.'
    ],
    'Require OP Quote Link': [
      false,
      'For purposes of thread watcher highlighting, only consider posts with a quote link to the OP as replies to the OP.'
    ]
  },

  filter: {
    general: '',

    postID: `\
# Highlight dubs on [s4s]:
#/(\\d)\\1$/;highlight;top:no;boards:s4s\
`,

    name: `\
# Filter any namefags:
#/^(?!Anonymous$)/\
`,

    uniqueID: `\
# Filter a specific ID:
#/Txhvk1Tl/\
`,

    tripcode: `\
# Filter any tripfag
#/^!/\
`,

    capcode: `\
# Set a custom class for mods:
#/Mod$/;highlight:mod;op:yes
# Set a custom class for admins:
#/Admin$/;highlight:admin;op:yes\
`,

    pass: `\
# Filter anyone using since4pass:
#/./\
`,

    email: '',

    subject: `\
# Filter Generals on /v/:
#/general/i;boards:v;op:only\
`,

    comment: `\
# Filter Stallman copypasta on /g/:
#/what you\'re refer+ing to as linux/i;boards:g
# Filter posts with 20 or more quote links:
#/(?:>>\\d(?:(?!>>\\d)[^])*){20}/
# Filter posts like T H I S / H / I / S:
#/^>?\\s?\\w\\s?(\\w)\\s?(\\w)\\s?(\\w).*$[\\s>]+\\1[\\s>]+\\2[\\s>]+\\3/im\
`,

    flag: '',
    filename: '',
    dimensions: `\
# Highlight potential wallpapers:
#/1920x1080/;op:yes;highlight;top:no;boards:w,wg\
`,

    filesize: '',

    MD5: ''
  },

  easyFilters: '',

  sauces: `\
# Known filename formats:
https://www.pixiv.net/member_illust.php?mode=medium&illust_id=%$1;regexp:/^(\\d+)_p\\d+/
javascript:void(open("https://www.deviantart.com/"+%$1.replace(/_/g,"-")+"/art/"+parseInt(%$2,36)));regexp:/^\\w+_by_(\\w+)[_-]d([\\da-z]{6})\\b/
https://imgur.com/%$1;regexp:/^(?![a-zA-Z][a-z]{6})(?![A-Z]{7})(?!\\d{7})([\\da-zA-Z]{7})(?: \\(\\d+\\))?\\.\\w+$/
https://flickr.com/photo.gne?id=%$1;regexp:/^(\\d+)_[\\da-f]{10}(?:_\\w)*\\b/
https://www.facebook.com/photo.php?fbid=%$1;regexp:/^\\d+_(\\d+)_\\d+_[no]\\b/

# Reverse image search:
https://www.google.com/searchbyimage?sbisrc=4chanx&image_url=%IMG&safe=off
https://yandex.com/images/search?rpt=imageview&url=%IMG
#//tineye.com/search?url=%IMG
#//www.bing.com/images/search?q=imgurl:%IMG&view=detailv2&iss=sbi#enterInsights
#https://lens.google.com/uploadbyurl?url=%IMG;text:lens

# Specialized reverse image search:
//iqdb.org/?url=%IMG
https://trace.moe/?auto&url=%IMG;text:trace
#//3d.iqdb.org/?url=%IMG
#//saucenao.com/search.php?url=%IMG

# "View Same" in archives:
http://eye.swfchan.com/search/?q=%name;types:swf
#https://desuarchive.org/_/search/image/%sMD5/
#https://archive.4plebs.org/_/search/image/%sMD5/
#https://boards.fireden.net/_/search/image/%sMD5/
#https://foolz.fireden.net/_/search/image/%sMD5/

# Other tools:
#http://exif.regex.info/exif.cgi?imgurl=%URL
#//imgops.com/start?url=%URL;types:gif,jpg,png
#//www.gif-explode.com/%URL;types:gif\
`,

  FappeT: {
    werk:  false
  },

  'Custom CSS': true,
  customCSSHome: false,
  siteStyle: '',
  siteStyleHome: false,
  stylingSectionSiteStyle: true,
  stylingSectionHighlights: true,
  stylingSectionScrollbarMarkers: true,
  stylingSectionTextColors: true,
  stylingSectionCustomCSS: true,
  stylingSectionsInitialized: false,
  customSiteThemes: [],
  savedHighlightPalettes: [],
  // 'auto' applies the SFW or NSFW variant based on the active board's
  // ws_board flag; 'sfw'/'nsfw' force a single variant everywhere.
  sfwNsfwMode: 'auto',
  // 'default' = leave text/link/greentext at the theme's native colors (no
  // override); 'auto' = compute readable colors from the background; 'manual'
  // = use the Text/Link/Quote/Dead-link color pickers below.
  textColorMode: 'default',
  'Text Color': '',
  'Link Text Color': '',
  'Quote Text Color': '',
  'Dead Link Text Color': '',
  'Scroll Marker Match Highlights': true,
  'Scroll Marker Own Match Highlight': true,
  'Scroll Marker You Match Highlight': true,
  'Scroll Marker Ghost Match Highlight': true,

  // Styling — highlight background colors and per-marker scroll colors.
  // Empty string = use the stylesheet default for the active theme.
  'Highlight Own Color':         '',
  'Highlight You Color':         '',
  'Highlight Ghost Color':       '',
  // Per-highlight text coloring: 'default' = theme colors (no override),
  // 'auto' = computed for contrast, 'manual' = the color pickers below.
  'Highlight Own Text Auto':     true,
  'Highlight You Text Auto':     true,
  'Highlight Ghost Text Auto':   true,
  'Highlight Own Text Mode':     'default',
  'Highlight You Text Mode':     'default',
  'Highlight Ghost Text Mode':   'default',
  'Highlight Own Text Color':    '',
  'Highlight Own Link Color':    '',
  'Highlight Own Quote Color':   '',
  'Highlight Own Dead Link Color': '',
  'Highlight You Text Color':    '',
  'Highlight You Link Color':    '',
  'Highlight You Quote Color':   '',
  'Highlight You Dead Link Color': '',
  'Highlight Ghost Text Color':  '',
  'Highlight Ghost Link Color':  '',
  'Highlight Ghost Quote Color': '',
  'Highlight Ghost Dead Link Color': '',
  'Highlight Own Opacity':       '',
  'Highlight You Opacity':       '',
  'Highlight Ghost Opacity':     '',
  'Thread Highlight Edge Width': 3,
  'Highlight Own Edge Width':    3,
  'Highlight You Edge Width':    3,
  'Highlight Ghost Edge Width':  3,
  // Border style of the colored left edge. Defaults preserve the classic XT
  // look (you: solid, own: dashed, ghost: dotted).
  'Highlight Own Border Style':  'dashed',
  'Highlight You Border Style':  'dashed',
  'Highlight Ghost Border Style':'dotted',
  'Highlight Own Background':     false,
  'Highlight You Background':     false,
  'Highlight Ghost Background':   false,
  'Enable Thread Highlights':    true,
  'Enable Catalog Highlights':   false,
  'Catalog Highlight Own Posts': true,
  'Catalog Highlight Watched Threads': true,
  'Catalog Highlight Own Color': '',
  'Catalog Highlight Own Opacity': '',
  'Catalog Highlight Own Background': false,
  'Catalog Highlight Watched Color': '',
  'Catalog Highlight Watched Opacity': '',
  'Catalog Highlight Watched Background': false,
  'Catalog Highlight Border Width': 2,
  'Catalog Highlight Own Border Width': 2,
  'Catalog Highlight Watched Border Width': 2,
  'Catalog Highlight Own Border Style': 'solid',
  'Catalog Highlight Watched Border Style': 'solid',
  // Where the catalog highlight is drawn: 'tile' (whole catalog entry) or
  // 'image' (just the thumbnail).
  'Catalog Highlight Own Location': 'tile',
  'Catalog Highlight Watched Location': 'tile',
  // Optional colored glow around the catalog highlight, with adjustable
  // intensity (0..1; ~0.5 matches the classic filter glow).
  'Catalog Highlight Own Glow': false,
  'Catalog Highlight Own Glow Intensity': 0.5,
  'Catalog Highlight Watched Glow': false,
  'Catalog Highlight Watched Glow Intensity': 0.5,
  // Filtered-thread catalog highlight. Independent of the Own/Watched master so
  // the classic filter glow keeps working out of the box; the color falls back
  // to each filter's own color when left blank. Defaults reproduce the eX glow.
  'Catalog Highlight Filter Posts': true,
  'Catalog Highlight Filter Color': '',
  'Catalog Highlight Filter Opacity': '',
  'Catalog Highlight Filter Background': false,
  'Catalog Highlight Filter Location': 'image',
  'Catalog Highlight Filter Border Width': 2,
  'Catalog Highlight Filter Border Style': 'solid',
  'Catalog Highlight Filter Glow': true,
  'Catalog Highlight Filter Glow Intensity': 0.5,
  'Catalog Highlight Filter Text Mode': 'default',
  'Catalog Highlight Filter Text Color': '',
  'Catalog Highlight Filter Subject Color': '',
  'Catalog Highlight Filter Link Color': '',
  'Catalog Highlight Filter Quote Color': '',
  'Catalog Highlight Filter Dead Link Color': '',
  'Catalog Highlight Own Text Mode': 'default',
  'Catalog Highlight Own Text Color': '',
  'Catalog Highlight Own Subject Color': '',
  'Catalog Highlight Own Link Color': '',
  'Catalog Highlight Own Quote Color': '',
  'Catalog Highlight Own Dead Link Color': '',
  'Catalog Highlight Watched Text Mode': 'default',
  'Catalog Highlight Watched Text Color': '',
  'Catalog Highlight Watched Subject Color': '',
  'Catalog Highlight Watched Link Color': '',
  'Catalog Highlight Watched Quote Color': '',
  'Catalog Highlight Watched Dead Link Color': '',
  'Scroll Marker Own Color':     '',
  'Scroll Marker You Color':     '',
  'Scroll Marker Ghost Color':   '',
  'Scroll Marker Unread Color':  '',
  'Scroll Marker Own Opacity':   '',
  'Scroll Marker You Opacity':   '',
  'Scroll Marker Ghost Opacity': '',
  'Scroll Marker Unread Opacity': '',
  'Scrollbar Marker Position': 'offset',

  Index: {
    'Index Mode': 'paged',
    'Previous Index Mode': 'paged',
    'Index Size': 'small',
    'Show Replies':          [true,  'Show replies in the index, and also in the catalog if "Catalog hover expand" is checked.'],
    'Catalog Hover Expand':  [false, 'Expand the comment and show more details when you hover over a thread in the catalog.'],
    'Catalog Hover Toggle':  [true,  'Turn "Catalog hover expand" on and off by clicking in the catalog.'],
    'Pin Watched Threads':   [false, 'Move watched threads to the start of the index.'],
    'Anchor Hidden Threads': [true,  'Move hidden threads to the end of the index.'],
    'Refreshed Navigation':  [false, 'Refresh index when navigating through pages.']
  },

  Header: {
    'Fixed Header':               true,
    'Header auto-hide':           false,
    'Header auto-hide on scroll': false,
    'Bottom Header':              false,
    'Centered links':             false,
    'Header catalog links':       false,
    'Bottom Board List':          true,
    'Hide Board Banner':          false,
    'Shortcut Icons':             true,
    'Custom Board Navigation':    true
  },

  archives: {
    archiveLists:      'https://4chenz.github.io/archives.json/archives.json',
    lastarchivecheck:  0,
    archiveAutoUpdate: true
  },

  externalCatalogURLs: `\
//catalog.neet.tv/%board/;boards:4chan.org:3,a,adv,an,asp,biz,c,cgl,ck,cm,co,diy,f,fa,fit,g,gd,his,i,int,jp,k,lgbt,lit,m,mlp,mu,n,news,o,out,p,po,pol,s4s,sci,sp,tg,toy,trv,tv,v,vg,vip,vp,vr,w,wg,wsg,wsr,x\
`,

  boardnav: `\
[ toggle-all ]
[current-index-text:"Index"
current-catalog-text:"Catalog"
current-expired-text:"Expired"
current-archive-text:"Archive"]
[external-text:"FAQ","${meta.faq}"]\
`,

  QR: {
    'QR.personas': `\
# These are examples - remove the leading # on any line to try that option out.

# --- Builds a name dropdown on /g/ with 3 options.
#name:"Anonymous";boards:g
#name:"Based Department";boards:g
#name:"Chad";boards:g

# --- All 3 show in the subject dropdown; "Programming General" is pre-filled.
#subject:"Linux";boards:g
#subject:"Sticky Suggestions";boards:g
#subject:"Programming General";boards:g;always

# --- Dropdown shows both; "fortune" pre-fills because it's lower in the list.
#options:"sage";boards:g;always
#options:"fortune";boards:g;always

# --- Board-scoped: only appears on the listed boards ---
#subject:"/v/ permavirgin general";boards:v,vg

# --- Global: no boards key means every board ---
#name:"Anonymous"

# --- Tripcode: goes in the name field as name#secret (not password) ---
#name:"Code Monkey#s3cret";boards:g

# --- Password: post deletion password, no dropdown, global only ---
#password:"hunter2"\
`,
    sjisPreview: false
  },

  jsWhitelist: '',

  captchaLanguage: '',

  time: '%m/%d/%y(%a)%H:%M:%S',
  timeLocale: '',
  RelativeTime: 'Hover',

  backlink: '>>%id',

  pastedname: 'file',

  fileInfo: '%l %d (%p%s, %r%g)',

  favicon: 'ferongr',

  usercss: userCss,

  hotkeys: {
    // QR & Options
    'Toggle board list': [
      'Ctrl+b',
      'Toggle the full board list.'
    ],
    'Toggle header': [
      'Shift+h',
      'Toggle the auto-hide option of the header.'
    ],
    'Open empty QR': [
      'q',
      'Open QR without post number inserted.'
    ],
    'Open QR': [
      'Shift+q',
      'Open QR with post number inserted.'
    ],
    'Open settings': [
      'Alt+o',
      'Open Settings.'
    ],
    'Close': [
      'Esc',
      'Close dialogs or notifications.'
    ],
    'Spoiler tags': [
      'Ctrl+s',
      'Insert spoiler tags.'
    ],
    'Code tags': [
      'Alt+c',
      'Insert code tags.'
    ],
    'Eqn tags':  [
      'Alt+e',
      'Insert eqn tags.'
    ],
    'Math tags': [
      'Alt+m',
      'Insert math tags.'
    ],
    'SJIS tags': [
      'Alt+a',
      'Insert SJIS tags.'
    ],
    'Toggle sage': [
      'Alt+s',
      'Toggle sage in options field.'
    ],
    'Toggle comment preview': [
      'Alt+v',
      'Toggle the QR comment preview.'
    ],
    'Toggle drafts': [
      'Alt+d',
      'Toggle the QR drafts panel.'
    ],
    'Toggle Cooldown': [
      'Alt+Comma',
      'Toggle custom cooldown timer.'
    ],
    'Post from URL': [
      'Alt+l',
      'Post from URL.'
    ],
    'Add new post': [
      'Alt+n',
      'Add new post to the QR dump list.'
    ],
    'Submit QR': [
      'Ctrl+Enter',
      'Submit post.'
    ],
    // Thread related
    'Watch': [
      'w',
      'Watch thread.'
    ],
    'Watch (catalog click)': [
      'Ctrl+Shift',
      'Catalog-click modifiers for watching threads. Leave empty to disable.'
    ],
    'Hide thread (catalog click)': [
      'Shift',
      'Hold these modifier(s) and click a catalog thread to hide it. Leave empty to disable.'
    ],
    'Undo last hide/filter': [
      'Ctrl+z',
      'Undo your most recent thread hide or MD5 quick-filter. Repeat to undo earlier ones (up to 10). Ignored while typing in a text field.'
    ],
    'Update': [
      'r',
      'Update the thread / refresh the index.'
    ],
    'Update thread watcher': [
      'Shift+r',
      'Manually refresh thread watcher.'
    ],
    'Toggle thread watcher': [
      't',
      'Toggle visibility of thread watcher.'
    ],
    'Toggle threading': [
      'Shift+t',
      'Toggle threading.'
    ],
    'Mark thread read': [
      'Ctrl+0',
      'Mark thread read from index (requires "Unread Line in Index").'
    ],
    // Images
    'Expand image': [
      'Shift+e',
      'Expand selected image.'
    ],
    'Expand images': [
      'e',
      'Expand all images.'
    ],
    'Open Gallery': [
      'g',
      'Opens the gallery.'
    ],
    'Next Gallery Image': [
      'Right',
      'Go to the next image in gallery mode.'
    ],
    'Previous Gallery Image': [
      'Left',
      'Go to the previous image in gallery mode.'
    ],
    'Advance Gallery': [
      'Enter',
      'Go to next image or, if Autoplay is off, play video.'
    ],
    'Pause': [
      'p',
      'Pause/play videos in the gallery.'
    ],
    'Slideshow': [
      'Ctrl+Right',
      'Toggle the gallery slideshow mode.'
    ],
    'Rotate image clockwise': [
      'Shift+Right',
      'Rotate image clockwise in gallery.'
    ],
    'Rotate image anticlockwise': [
      'Shift+Left',
      'Rotate image anticlockwise in gallery.'
    ],
    'Download Gallery Image': [
      'Shift+j',
      'Download current image in gallery.'
    ],
    'Download all media': [
      'Shift+d',
      'Download all media in the current thread/index.'
    ],
    'fappeTyme': [
      'f',
      'Toggle Fappe Tyme.'
    ],
    'werkTyme': [
      'Shift+w',
      'Toggle Werk Tyme.'
    ],
    // Board Navigation
    'Front page': [
      '1',
      'Jump to front page.'
    ],
    'Open front page': [
      'Shift+1',
      'Open front page in a new tab.'
    ],
    'Next page': [
      'Ctrl+Right',
      'Jump to the next page.'
    ],
    'Previous page': [
      'Ctrl+Left',
      'Jump to the previous page.'
    ],
    'Paged mode': [
      'Alt+1',
      'Open the index in paged mode.'
    ],
    'Infinite scrolling mode': [
      'Alt+2',
      'Open the index in infinite scrolling mode.'
    ],
    'All pages mode': [
      'Alt+3',
      'Open the index in all threads mode.'
    ],
    'Open catalog': [
      'Shift+c',
      'Open the catalog of the current board.'
    ],
    'Search form': [
      'Ctrl+Alt+s',
      'Focus the search field on the board index.'
    ],
    'Cycle sort type': [
      'Alt+x',
      'Cycle through index sort types.'
    ],
    // Thread Navigation
    'Next thread': [
      'Ctrl+Down',
      'See next thread.'
    ],
    'Previous thread': [
      'Ctrl+Up',
      'See previous thread.'
    ],
    'Expand thread': [
      'Ctrl+e',
      'Expand thread.'
    ],
    'Open thread': [
      'o',
      'Open thread in current tab.'
    ],
    'Open thread tab': [
      'Shift+o',
      'Open thread in new tab.'
    ],
    // Reply Navigation
    'Next reply': [
      'j',
      'Select next reply.'
    ],
    'Previous reply': [
      'k',
      'Select previous reply.'
    ],
    'Deselect reply': [
      'Shift+d',
      'Deselect reply.'
    ],
    'Hide': [
      'x',
      'Hide thread.'
    ],
    'Quick Filter MD5': [
      '5',
      'Add the MD5 of the selected image to the filter list.'
    ],
    'Previous Post Quoting You': [
      'Alt+Up',
      'Scroll to the previous post that quotes you.'
    ],
    'Next Post Quoting You': [
      'Alt+Down',
      'Scroll to the next post that quotes you.'
    ]
  },

  updater: {
    checkbox: {
      'Beep': [
        false,
        'Beep on new post to completely read thread.'
      ],
      'Beep Quoting You': [
        false,
        'Beep on new post quoting you.'
      ],
      'Auto Scroll': [
        false,
        'Scroll updated posts into view. Only enabled at bottom of page.'
      ],
      'Bottom Scroll': [
        false,
        'Always scroll to the bottom, not the first new post. Useful for event threads.'
      ],
      'Scroll BG': [
        false,
        'Auto-scroll background tabs.'
      ],
      'Auto Update': [
        true,
        'Automatically fetch new posts.'
      ],
      'Optional Increase': [
        false,
        'Increase the intervals between updates on threads without new posts.'
      ]
    },
    'Interval': 5
  },

  customCooldown: 0,
  customCooldownEnabled: true,

  'Thread Quotes': false,

  'Max Replies': 1000,

  'Autohiding Scrollbar': false,

  position: {
    'embedding.position':      'top: 50px; right: 0px;',
    'thread-stats.position':   'bottom: 0px; right: 0px;',
    'updater.position':        'bottom: 0px; left: 0px;',
    'thread-watcher.position': 'top: 50px; left: 0px;',
    'qr.position':             'top: 50px; right: 0px;',
    'download-all-picker.position': 'top: 100px; right: 60px;'
  },

  fourchanImageHost: 'i.4cdn.org',

  hiddenPSAList: [{}],

  knownBanners: banners.join(','),

  passMessageClosed: false,

  'PSAseen': [[]],

  XEmbedder: 'fxt',
  fxtLang: '',
  fxtUrl: 'https://api.fxtwitter.com',
  fxtMaxReplies: 5,

  beepSource: '',
  beepVolume: 1,
  soundLibrary: [[]],
  boardSounds: [{}],
  defaultSoundId: '',
};

// Visual styling settings get separate SFW and NSFW values so the user can
// keep two color/theme palettes and have the right one applied based on the
// active board's worksafe flag (or a forced override).
export const styleVariantKeys = [
  'siteStyle',
  'usercss',
  'textColorMode',
  'Text Color', 'Link Text Color', 'Quote Text Color', 'Dead Link Text Color',
  'Highlight Own Color', 'Highlight You Color', 'Highlight Ghost Color',
  'Highlight Own Opacity', 'Highlight You Opacity', 'Highlight Ghost Opacity',
  'Thread Highlight Edge Width',
  'Highlight Own Edge Width', 'Highlight You Edge Width', 'Highlight Ghost Edge Width',
  'Highlight Own Border Style', 'Highlight You Border Style', 'Highlight Ghost Border Style',
  'Highlight Own Text Mode', 'Highlight You Text Mode', 'Highlight Ghost Text Mode',
  'Highlight Own Text Color', 'Highlight Own Link Color', 'Highlight Own Quote Color', 'Highlight Own Dead Link Color',
  'Highlight You Text Color', 'Highlight You Link Color', 'Highlight You Quote Color', 'Highlight You Dead Link Color',
  'Highlight Ghost Text Color', 'Highlight Ghost Link Color', 'Highlight Ghost Quote Color', 'Highlight Ghost Dead Link Color',
  'Catalog Highlight Own Color', 'Catalog Highlight Own Opacity',
  'Catalog Highlight Own Background',
  'Catalog Highlight Watched Color', 'Catalog Highlight Watched Opacity',
  'Catalog Highlight Watched Background',
  'Catalog Highlight Border Width',
  'Catalog Highlight Own Border Width', 'Catalog Highlight Watched Border Width',
  'Catalog Highlight Own Border Style', 'Catalog Highlight Watched Border Style',
  'Catalog Highlight Own Location', 'Catalog Highlight Watched Location',
  'Catalog Highlight Own Glow', 'Catalog Highlight Own Glow Intensity',
  'Catalog Highlight Watched Glow', 'Catalog Highlight Watched Glow Intensity',
  'Catalog Highlight Filter Posts', 'Catalog Highlight Filter Color', 'Catalog Highlight Filter Opacity',
  'Catalog Highlight Filter Background', 'Catalog Highlight Filter Location',
  'Catalog Highlight Filter Border Width', 'Catalog Highlight Filter Border Style',
  'Catalog Highlight Filter Glow', 'Catalog Highlight Filter Glow Intensity',
  'Catalog Highlight Filter Text Mode',
  'Catalog Highlight Filter Text Color', 'Catalog Highlight Filter Subject Color', 'Catalog Highlight Filter Link Color', 'Catalog Highlight Filter Quote Color', 'Catalog Highlight Filter Dead Link Color',
  'Catalog Highlight Own Text Mode',
  'Catalog Highlight Own Text Color', 'Catalog Highlight Own Subject Color', 'Catalog Highlight Own Link Color', 'Catalog Highlight Own Quote Color', 'Catalog Highlight Own Dead Link Color',
  'Catalog Highlight Watched Text Mode',
  'Catalog Highlight Watched Text Color', 'Catalog Highlight Watched Subject Color', 'Catalog Highlight Watched Link Color', 'Catalog Highlight Watched Quote Color', 'Catalog Highlight Watched Dead Link Color',
  'Scroll Marker Own Color', 'Scroll Marker You Color', 'Scroll Marker Ghost Color', 'Scroll Marker Unread Color',
  'Scroll Marker Own Opacity', 'Scroll Marker You Opacity', 'Scroll Marker Ghost Opacity', 'Scroll Marker Unread Opacity',
  'Scroll Marker Own Match Highlight', 'Scroll Marker You Match Highlight', 'Scroll Marker Ghost Match Highlight',
];

for (const k of styleVariantKeys) {
  const cfg = Config as Record<string, unknown>; // loose: dynamic style-variant keys not in static Config shape
  cfg[`${k} SFW`] = cfg[k];
  cfg[`${k} NSFW`] = cfg[k];
}

export default Config;
