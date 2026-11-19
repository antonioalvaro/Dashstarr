// Official Tabler Icons (outline, MIT License: https://github.com/tabler/tabler-icons)
(function (root) {
  'use strict';

  const DEFAULT_ICON = 'device-desktop';
  const PALETTE = [
    '#0a84ff', '#bf5af2', '#40c8e0', '#ff9f0a',
    '#ff375f', '#30d158', '#5e5ce6', '#ff453a',
    '#14b8a6', '#f97316', '#ec4899', '#64748b',
  ];

  const ICONS = [
  {
    "id": "device-desktop",
    "label": "Desktop",
    "tags": "computer monitor pc screen",
    "body": "<path d=\"M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10\" /><path d=\"M7 20h10\" /><path d=\"M9 16v4\" /><path d=\"M15 16v4\" />"
  },
  {
    "id": "device-laptop",
    "label": "Laptop",
    "tags": "notebook computer macbook",
    "body": "<path d=\"M3 19l18 0\" /><path d=\"M5 7a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -8\" />"
  },
  {
    "id": "server",
    "label": "Server",
    "tags": "rack host machine",
    "body": "<path d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2\" /><path d=\"M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2\" /><path d=\"M7 8l0 .01\" /><path d=\"M7 16l0 .01\" />"
  },
  {
    "id": "server-2",
    "label": "Server Stack",
    "tags": "cluster nodes rack",
    "body": "<path d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2\" /><path d=\"M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2\" /><path d=\"M7 8l0 .01\" /><path d=\"M7 16l0 .01\" /><path d=\"M11 8h6\" /><path d=\"M11 16h6\" />"
  },
  {
    "id": "cpu",
    "label": "CPU",
    "tags": "processor hardware chip",
    "body": "<path d=\"M5 6a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -12\" /><path d=\"M9 9h6v6h-6l0 -6\" /><path d=\"M3 10h2\" /><path d=\"M3 14h2\" /><path d=\"M10 3v2\" /><path d=\"M14 3v2\" /><path d=\"M21 10h-2\" /><path d=\"M21 14h-2\" /><path d=\"M14 21v-2\" /><path d=\"M10 21v-2\" />"
  },
  {
    "id": "terminal-2",
    "label": "Terminal",
    "tags": "shell ssh bash console cli",
    "body": "<path d=\"M8 9l3 3l-3 3\" /><path d=\"M13 15l3 0\" /><path d=\"M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -12\" />"
  },
  {
    "id": "code",
    "label": "Code",
    "tags": "ide editor programming dev",
    "body": "<path d=\"M7 8l-4 4l4 4\" /><path d=\"M17 8l4 4l-4 4\" /><path d=\"M14 4l-4 16\" />"
  },
  {
    "id": "box",
    "label": "Box",
    "tags": "package container",
    "body": "<path d=\"M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5\" /><path d=\"M12 12l8 -4.5\" /><path d=\"M12 12l0 9\" /><path d=\"M12 12l-8 -4.5\" />"
  },
  {
    "id": "cube",
    "label": "Cube",
    "tags": "container 3d vm",
    "body": "<path d=\"M21 16.008v-8.018a1.98 1.98 0 0 0 -1 -1.717l-7 -4.008a2.016 2.016 0 0 0 -2 0l-7 4.008c-.619 .355 -1 1.01 -1 1.718v8.018c0 .709 .381 1.363 1 1.717l7 4.008a2.016 2.016 0 0 0 2 0l7 -4.008c.619 -.355 1 -1.01 1 -1.718\" /><path d=\"M12 22v-10\" /><path d=\"M12 12l8.73 -5.04\" /><path d=\"M3.27 6.96l8.73 5.04\" />"
  },
  {
    "id": "brand-docker",
    "label": "Docker",
    "tags": "container whale",
    "body": "<path d=\"M22 12.54c-1.804 -.345 -2.701 -1.08 -3.523 -2.94c-.487 .696 -1.102 1.568 -.92 2.4c.028 .238 -.32 1 -.557 1h-14c0 5.208 3.164 7 6.196 7c4.124 .022 7.828 -1.376 9.854 -5c1.146 -.101 2.296 -1.505 2.95 -2.46\" /><path d=\"M5 10h3v3h-3l0 -3\" /><path d=\"M8 10h3v3h-3l0 -3\" /><path d=\"M11 10h3v3h-3l0 -3\" /><path d=\"M8 7h3v3h-3l0 -3\" /><path d=\"M11 7h3v3h-3l0 -3\" /><path d=\"M11 4h3v3h-3l0 -3\" /><path d=\"M4.571 18c1.5 0 2.047 -.074 2.958 -.78\" /><path d=\"M10 16l0 .01\" />"
  },
  {
    "id": "brand-ubuntu",
    "label": "Ubuntu",
    "tags": "linux os distro",
    "body": "<path d=\"M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M17.723 7.41a7.992 7.992 0 0 0 -3.74 -2.162m-3.971 0a7.993 7.993 0 0 0 -3.789 2.216m-1.881 3.215a8 8 0 0 0 -.342 2.32c0 .738 .1 1.453 .287 2.132m1.96 3.428a7.993 7.993 0 0 0 3.759 2.19m4 0a7.993 7.993 0 0 0 3.747 -2.186m1.962 -3.43a8.008 8.008 0 0 0 .287 -2.131c0 -.764 -.107 -1.503 -.307 -2.203\" /><path d=\"M3 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M17 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />"
  },
  {
    "id": "brand-apple",
    "label": "macOS",
    "tags": "apple mac",
    "body": "<path d=\"M8.286 7.008c-3.216 0 -4.286 3.23 -4.286 5.92c0 3.229 2.143 8.072 4.286 8.072c1.165 -.05 1.799 -.538 3.214 -.538c1.406 0 1.607 .538 3.214 .538s4.286 -3.229 4.286 -5.381c-.03 -.011 -2.649 -.434 -2.679 -3.23c-.02 -2.335 2.589 -3.179 2.679 -3.228c-1.096 -1.606 -3.162 -2.113 -3.75 -2.153c-1.535 -.12 -3.032 1.077 -3.75 1.077c-.729 0 -2.036 -1.077 -3.214 -1.077\" /><path d=\"M12 4a2 2 0 0 0 2 -2a2 2 0 0 0 -2 2\" />"
  },
  {
    "id": "world",
    "label": "Web",
    "tags": "globe browser internet",
    "body": "<path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" /><path d=\"M3.6 9h16.8\" /><path d=\"M3.6 15h16.8\" /><path d=\"M11.5 3a17 17 0 0 0 0 18\" /><path d=\"M12.5 3a17 17 0 0 1 0 18\" />"
  },
  {
    "id": "wifi",
    "label": "Wi-Fi",
    "tags": "wireless network",
    "body": "<path d=\"M12 18l.01 0\" /><path d=\"M9.172 15.172a4 4 0 0 1 5.656 0\" /><path d=\"M6.343 12.343a8 8 0 0 1 11.314 0\" /><path d=\"M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0\" />"
  },
  {
    "id": "router",
    "label": "Router",
    "tags": "gateway modem network",
    "body": "<path d=\"M3 15a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -4\" /><path d=\"M17 17l0 .01\" /><path d=\"M13 17l0 .01\" /><path d=\"M15 13l0 -2\" /><path d=\"M11.75 8.75a4 4 0 0 1 6.5 0\" /><path d=\"M8.5 6.5a8 8 0 0 1 13 0\" />"
  },
  {
    "id": "network",
    "label": "Network",
    "tags": "lan mesh tailscale",
    "body": "<path d=\"M6 9a6 6 0 1 0 12 0a6 6 0 0 0 -12 0\" /><path d=\"M12 3c1.333 .333 2 2.333 2 6s-.667 5.667 -2 6\" /><path d=\"M12 3c-1.333 .333 -2 2.333 -2 6s.667 5.667 2 6\" /><path d=\"M6 9h12\" /><path d=\"M3 20h7\" /><path d=\"M14 20h7\" /><path d=\"M10 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" /><path d=\"M12 15v3\" />"
  },
  {
    "id": "cloud",
    "label": "Cloud",
    "tags": "remote sync storage",
    "body": "<path d=\"M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878\" />"
  },
  {
    "id": "shield-lock",
    "label": "Security",
    "tags": "vpn auth firewall",
    "body": "<path d=\"M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3\" /><path d=\"M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M12 12l0 2.5\" />"
  },
  {
    "id": "lock",
    "label": "Lock",
    "tags": "private vault password",
    "body": "<path d=\"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6\" /><path d=\"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0\" /><path d=\"M8 11v-4a4 4 0 1 1 8 0v4\" />"
  },
  {
    "id": "key",
    "label": "Key",
    "tags": "ssh token auth",
    "body": "<path d=\"M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0\" /><path d=\"M15 9h.01\" />"
  },
  {
    "id": "home",
    "label": "Home",
    "tags": "homelab dashboard selfhost",
    "body": "<path d=\"M5 12l-2 0l9 -9l9 9l-2 0\" /><path d=\"M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7\" /><path d=\"M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6\" />"
  },
  {
    "id": "bolt",
    "label": "Power",
    "tags": "fast lightning action",
    "body": "<path d=\"M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11\" />"
  },
  {
    "id": "movie",
    "label": "Movies",
    "tags": "plex jellyfin emby cinema film",
    "body": "<path d=\"M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12\" /><path d=\"M8 4l0 16\" /><path d=\"M16 4l0 16\" /><path d=\"M4 8l4 0\" /><path d=\"M4 16l4 0\" /><path d=\"M4 12l16 0\" /><path d=\"M16 8l4 0\" /><path d=\"M16 16l4 0\" />"
  },
  {
    "id": "device-tv",
    "label": "TV",
    "tags": "shows stream media",
    "body": "<path d=\"M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9\" /><path d=\"M16 3l-4 4l-4 -4\" />"
  },
  {
    "id": "music",
    "label": "Music",
    "tags": "audio plexamp navidrome",
    "body": "<path d=\"M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" /><path d=\"M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" /><path d=\"M9 17v-13h10v13\" /><path d=\"M9 8h10\" />"
  },
  {
    "id": "headphones",
    "label": "Audio",
    "tags": "podcast stream",
    "body": "<path d=\"M4 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3\" /><path d=\"M15 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3\" /><path d=\"M4 15v-3a8 8 0 0 1 16 0v3\" />"
  },
  {
    "id": "photo",
    "label": "Photos",
    "tags": "immich gallery images",
    "body": "<path d=\"M15 8h.01\" /><path d=\"M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12\" /><path d=\"M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5\" /><path d=\"M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3\" />"
  },
  {
    "id": "book",
    "label": "Books",
    "tags": "audiobookshelf calibre docs wiki",
    "body": "<path d=\"M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0\" /><path d=\"M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0\" /><path d=\"M3 6l0 13\" /><path d=\"M12 6l0 13\" /><path d=\"M21 6l0 13\" />"
  },
  {
    "id": "device-gamepad-2",
    "label": "Gaming",
    "tags": "games stream moonlight",
    "body": "<path d=\"M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4\" /><path d=\"M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232\" /><path d=\"M8 9v2\" /><path d=\"M7 10h2\" /><path d=\"M14 10h2\" />"
  },
  {
    "id": "player-play",
    "label": "Player",
    "tags": "media video stream",
    "body": "<path d=\"M7 4v16l13 -8l-13 -8\" />"
  },
  {
    "id": "download",
    "label": "Downloads",
    "tags": "sabnzbd qbit transmission",
    "body": "<path d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2\" /><path d=\"M7 11l5 5l5 -5\" /><path d=\"M12 4l0 12\" />"
  },
  {
    "id": "rss",
    "label": "Feeds",
    "tags": "rss news arr",
    "body": "<path d=\"M4 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M4 4a16 16 0 0 1 16 16\" /><path d=\"M4 11a9 9 0 0 1 9 9\" />"
  },
  {
    "id": "radar-2",
    "label": "Radar",
    "tags": "radarr sonarr discovery",
    "body": "<path d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M15.51 15.56a5 5 0 1 0 -3.51 1.44\" /><path d=\"M18.832 17.86a9 9 0 1 0 -6.832 3.14\" /><path d=\"M12 12v9\" />"
  },
  {
    "id": "flame",
    "label": "Flame",
    "tags": "hot trending",
    "body": "<path d=\"M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235\" />"
  },
  {
    "id": "database",
    "label": "Database",
    "tags": "postgres sql storage",
    "body": "<path d=\"M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0\" /><path d=\"M4 6v6a8 3 0 0 0 16 0v-6\" /><path d=\"M4 12v6a8 3 0 0 0 16 0v-6\" />"
  },
  {
    "id": "folder",
    "label": "Files",
    "tags": "nas smb shares",
    "body": "<path d=\"M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2\" />"
  },
  {
    "id": "archive",
    "label": "Backup",
    "tags": "vault snapshot",
    "body": "<path d=\"M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2\" /><path d=\"M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10\" /><path d=\"M10 12l4 0\" />"
  },
  {
    "id": "file-code",
    "label": "Scripts",
    "tags": "config yaml json",
    "body": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\" /><path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" /><path d=\"M10 13l-1 2l1 2\" /><path d=\"M14 13l1 2l-1 2\" />"
  },
  {
    "id": "git-branch",
    "label": "Git",
    "tags": "repo gitea forgejo",
    "body": "<path d=\"M5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M5 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M15 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M7 8l0 8\" /><path d=\"M9 18h6a2 2 0 0 0 2 -2v-5\" /><path d=\"M14 14l3 -3l3 3\" />"
  },
  {
    "id": "bug",
    "label": "Debug",
    "tags": "issues logs",
    "body": "<path d=\"M9 9v-1a3 3 0 0 1 6 0v1\" /><path d=\"M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3\" /><path d=\"M3 13l4 0\" /><path d=\"M17 13l4 0\" /><path d=\"M12 20l0 -6\" /><path d=\"M4 19l3.35 -2\" /><path d=\"M20 19l-3.35 -2\" /><path d=\"M4 7l3.75 2.4\" /><path d=\"M20 7l-3.75 2.4\" />"
  },
  {
    "id": "settings",
    "label": "Settings",
    "tags": "admin config",
    "body": "<path d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065\" /><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />"
  },
  {
    "id": "tool",
    "label": "Tools",
    "tags": "utilities maintenance",
    "body": "<path d=\"M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5\" />"
  },
  {
    "id": "activity",
    "label": "Activity",
    "tags": "uptime status pulse",
    "body": "<path d=\"M3 12h4l3 8l4 -16l3 8h4\" />"
  },
  {
    "id": "chart-bar",
    "label": "Metrics",
    "tags": "grafana stats analytics",
    "body": "<path d=\"M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6\" /><path d=\"M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10\" /><path d=\"M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14\" /><path d=\"M4 20h14\" />"
  },
  {
    "id": "gauge",
    "label": "Monitor",
    "tags": "performance load",
    "body": "<path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" /><path d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M13.41 10.59l2.59 -2.59\" /><path d=\"M7 12a5 5 0 0 1 5 -5\" />"
  },
  {
    "id": "dashboard",
    "label": "Dashboard",
    "tags": "grafana homepage",
    "body": "<path d=\"M10 13a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M13.45 11.55l2.05 -2.05\" /><path d=\"M6.4 20a9 9 0 1 1 11.2 0l-11.2 0\" />"
  },
  {
    "id": "robot",
    "label": "Bot / AI",
    "tags": "automation llm assistant",
    "body": "<path d=\"M6 6a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -4\" /><path d=\"M12 2v2\" /><path d=\"M9 12v9\" /><path d=\"M15 12v9\" /><path d=\"M5 16l4 -2\" /><path d=\"M15 14l4 2\" /><path d=\"M9 18h6\" /><path d=\"M10 8v.01\" /><path d=\"M14 8v.01\" />"
  },
  {
    "id": "brain",
    "label": "AI / ML",
    "tags": "ollama openwebui neural",
    "body": "<path d=\"M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8\" /><path d=\"M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8\" /><path d=\"M17.5 16a3.5 3.5 0 0 0 0 -7h-.5\" /><path d=\"M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0\" /><path d=\"M6.5 16a3.5 3.5 0 0 1 0 -7h.5\" /><path d=\"M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10\" />"
  },
  {
    "id": "camera",
    "label": "Cameras",
    "tags": "frigate nvr cctv",
    "body": "<path d=\"M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2\" /><path d=\"M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />"
  },
  {
    "id": "video",
    "label": "Video",
    "tags": "obs stream",
    "body": "<path d=\"M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4\" /><path d=\"M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8\" />"
  },
  {
    "id": "mail",
    "label": "Mail",
    "tags": "email webmail",
    "body": "<path d=\"M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10\" /><path d=\"M3 7l9 6l9 -6\" />"
  },
  {
    "id": "message",
    "label": "Chat",
    "tags": "matrix irc messaging",
    "body": "<path d=\"M8 9h8\" /><path d=\"M8 13h6\" /><path d=\"M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12\" />"
  },
  {
    "id": "calendar",
    "label": "Calendar",
    "tags": "schedule events",
    "body": "<path d=\"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12\" /><path d=\"M16 3v4\" /><path d=\"M8 3v4\" /><path d=\"M4 11h16\" />"
  },
  {
    "id": "notes",
    "label": "Notes",
    "tags": "wiki obsidian markdown",
    "body": "<path d=\"M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14\" /><path d=\"M9 7l6 0\" /><path d=\"M9 11l6 0\" /><path d=\"M9 15l4 0\" />"
  },
  {
    "id": "rocket",
    "label": "Deploy",
    "tags": "ci launch",
    "body": "<path d=\"M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3\" /><path d=\"M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3\" /><path d=\"M14 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />"
  },
  {
    "id": "star",
    "label": "Favorite",
    "tags": "pinned star",
    "body": "<path d=\"M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245\" />"
  }
];

  const ICON_MAP = Object.create(null);
  for (const item of ICONS) ICON_MAP[item.id] = item;

  function colorFor(id) {
    let h = 0;
    for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % 8];
  }

  function isValidColor(color) {
    return /^#[0-9a-f]{6}$/i.test(String(color || '').trim());
  }

  function normalizeColor(color) {
    const s = String(color || '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(s) ? s : '';
  }

  function normalizeIcon(id) {
    const s = String(id || '').trim();
    return Object.prototype.hasOwnProperty.call(ICON_MAP, s) ? s : '';
  }

  function resolveColor(serverOrColor, fallbackId) {
    const raw = serverOrColor && typeof serverOrColor === 'object' ? serverOrColor.color : serverOrColor;
    const id = serverOrColor && typeof serverOrColor === 'object' ? serverOrColor.id : fallbackId;
    return normalizeColor(raw) || colorFor(id);
  }

  function resolveIcon(id) {
    return normalizeIcon(id) || DEFAULT_ICON;
  }

  function iconSvg(id, strokeWidth = 1.75) {
    const sw = Number(strokeWidth) || 1.75;
    const entry = ICON_MAP[resolveIcon(id)];
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${entry.body}</svg>`;
  }

  const api = {
    DEFAULT_ICON,
    PALETTE,
    ICONS,
    ICON_MAP,
    colorFor,
    isValidColor,
    normalizeColor,
    normalizeIcon,
    resolveColor,
    resolveIcon,
    iconSvg,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DashIcons = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
