/**
 * Import right after `env.ts` in a test of a desktop-only feature: the server then runs as inside the desktop
 * application (`config.desktop`), as it does when Electron starts it.
 */
process.env.GAME_MANAGER_DESKTOP = '1';
