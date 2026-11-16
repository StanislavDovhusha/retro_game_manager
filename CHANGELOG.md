# Changelog

All notable changes to Retro Game Manager are listed here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-17

The first public release.

### Added

- Manage the games on the SD card of your retro handheld from a computer: Windows, macOS and Linux.
- Supported consoles: SF3000, SF3000 HD, SF3000 HD without HDMI, SF3100 and SF3500. The console model is recognized by the folders on the card.
- A grid of the card's platforms on the main screen, with the number of games on each. Pick one with the mouse or the keyboard.
- Add games by dragging them into the window: single game files, `.zip`, disc images (`.bin` + `.cue`, CloneCD `.ccd` + `.img` + `.sub`, `.ecm`). Disc images become one file the console can read.
- Optional compression of a new game into a `.zip` archive.
- Covers: add your own picture (PNG, JPG, WEBP, BMP, GIF), or let the app draw one in the colours of the platform.
- Edit a game's title, short name and tags right in the table.
- Rename a game safely: the game file, cover, saves, quick saves and the console's own lists are renamed together. If anything fails, everything is put back.
- Delete a game, or only its cover.
- Sync `filelist.csv` with the games that are really on the card, with a preview before anything changes.
- The console's game lists (`allfiles.lst`, `favorites.lst`, `recent.lst`) follow every change: added, renamed, deleted and synced games.
- Search across the games of all platforms at once.
- Start a game in an emulator on the computer: OpenEmu on macOS, RetroArch on Windows and Linux.
- A short guided tour on the first start, and useful tips when the computer does not see the card.
- A notice when a newer version is released on GitHub.
- 13 interface languages: English, Ukrainian, Russian, German, Polish, Spanish, French, Italian, Japanese, Simplified Chinese, Korean, Czech and Kazakh. The language of the system is used until you choose one.
- Backups: every list and CSV is copied to the app's own data folder before it changes. Nothing of the app is left on the card.

### Changed

- The app is now called **Retro Game Manager** (earlier test builds were called "Game Manager" and "SF3000 Game Manager"). Settings, backups and logs of those builds move to the new data folder automatically on the first start.
- Game titles and short names use English letters, digits, spaces and `- _ ( ) [ ] . & # :` only, because the console cannot show other alphabets. Older games with other characters are marked in the table and can be renamed.
- `Music` is treated as a media folder, like `Ebook`, `Photo` and `Movie`: it is never shown as a platform.

### Fixed

- A card that was removed, or whose drive letter changed, no longer leaves the app pointing to a missing folder: the choice is reset and the start screen appears.
- Console lists in another encoding, or damaged ones, are never overwritten: the app shows an error and keeps the file as it is.

[1.0.0]: https://github.com/StanislavDovhusha/retro_game_manager/releases/tag/v1.0.0
