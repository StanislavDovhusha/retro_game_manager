# Third-party licenses

Retro Game Manager is licensed under the GNU General Public License v3.0 or later (see [LICENSE.md](LICENSE.md)). It ships the third-party components listed below. All of them are under licenses compatible with GPL-3.0: MIT, ISC, BSD (2-/3-clause, 0BSD), Apache-2.0 (compatible with GPLv3) and LGPL-3.0-or-later.

The full license texts are in each package (`LICENSE` files inside the application's `resources/app.asar` and `resources/app.asar.unpacked`).

## Runtime and native binaries

| Component                                     | Version | License           | Notes                                                                                                                                                                                                                             |
| --------------------------------------------- | ------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron                                      | 43.8.9  | MIT               | The desktop shell. It includes Chromium, Node.js, FFmpeg and other components under their own licenses (BSD, MIT, LGPL-2.1 and others); their texts ship with the application as `LICENSES.chromium.html` next to the executable. |
| `sharp`                                       | 0.35.5  | Apache-2.0        | Image conversion (covers).                                                                                                                                                                                                        |
| `@img/sharp-<system>-<cpu>`                   | 0.35.5  | Apache-2.0        | The prebuilt native module of sharp for each system (`darwin-x64`, `darwin-arm64`, `win32-x64`, `linux-x64`).                                                                                                                     |
| `@img/sharp-libvips-<system>-<cpu>` (libvips) | 1.3.4   | LGPL-3.0-or-later | The libvips image library, a shared library loaded by sharp (unpacked next to the archive, so it can be replaced). Source: <https://github.com/libvips/libvips>.                                                                  |

No other binaries are included. Disc images (`.bin`/`.cue`, CloneCD, `.ecm`) and ZIP archives are handled by the application's own TypeScript code.

## Server and desktop dependencies

These packages run in the application's built-in server and the desktop shell (100 packages).

| Package                         | Version | License           | Source                                                 |
| ------------------------------- | ------- | ----------------- | ------------------------------------------------------ |
| `@img/colour`                   | 1.1.0   | MIT               | <https://github.com/lovell/colour>                     |
| `@img/sharp-darwin-x64`         | 0.35.5  | Apache-2.0        | <https://github.com/lovell/sharp>                      |
| `@img/sharp-libvips-darwin-x64` | 1.3.4   | LGPL-3.0-or-later | <https://github.com/lovell/sharp-libvips>              |
| `@pinojs/redact`                | 0.4.0   | MIT               | <https://github.com/pinojs/redact>                     |
| `accepts`                       | 1.3.8   | MIT               | <https://github.com/jshttp/accepts>                    |
| `array-flatten`                 | 1.1.1   | MIT               | <https://github.com/blakeembrey/array-flatten>         |
| `atomic-sleep`                  | 1.0.0   | MIT               | <https://github.com/davidmarkclements/atomic-sleep>    |
| `body-parser`                   | 1.20.9  | MIT               | <https://github.com/expressjs/body-parser>             |
| `bytes`                         | 3.1.2   | MIT               | <https://github.com/visionmedia/bytes.js>              |
| `call-bind-apply-helpers`       | 1.0.2   | MIT               | <https://github.com/ljharb/call-bind-apply-helpers>    |
| `call-bound`                    | 1.0.4   | MIT               | <https://github.com/ljharb/call-bound>                 |
| `compressible`                  | 2.0.18  | MIT               | <https://github.com/jshttp/compressible>               |
| `compression`                   | 1.8.2   | MIT               | <https://github.com/expressjs/compression>             |
| `content-disposition`           | 0.5.4   | MIT               | <https://github.com/jshttp/content-disposition>        |
| `content-type`                  | 1.0.5   | MIT               | <https://github.com/jshttp/content-type>               |
| `cookie`                        | 0.7.2   | MIT               | <https://github.com/jshttp/cookie>                     |
| `cookie-signature`              | 1.0.7   | MIT               | <https://github.com/visionmedia/node-cookie-signature> |
| `cors`                          | 2.8.6   | MIT               | <https://github.com/expressjs/cors>                    |
| `csv-parse`                     | 5.6.0   | MIT               | <https://github.com/adaltas/node-csv>                  |
| `csv-stringify`                 | 6.9.0   | MIT               | <https://github.com/adaltas/node-csv>                  |
| `debug`                         | 2.6.9   | MIT               | <https://github.com/visionmedia/debug>                 |
| `depd`                          | 2.0.0   | MIT               | <https://github.com/dougwilson/nodejs-depd>            |
| `destroy`                       | 1.2.0   | MIT               | <https://github.com/stream-utils/destroy>              |
| `detect-libc`                   | 2.1.2   | Apache-2.0        | <https://github.com/lovell/detect-libc>                |
| `dunder-proto`                  | 1.0.1   | MIT               | <https://github.com/es-shims/dunder-proto>             |
| `ee-first`                      | 1.1.1   | MIT               | <https://github.com/jonathanong/ee-first>              |
| `encodeurl`                     | 2.0.3   | MIT               | <https://github.com/pillarjs/encodeurl>                |
| `es-define-property`            | 1.0.1   | MIT               | <https://github.com/ljharb/es-define-property>         |
| `es-errors`                     | 1.3.0   | MIT               | <https://github.com/ljharb/es-errors>                  |
| `es-object-atoms`               | 1.1.2   | MIT               | <https://github.com/ljharb/es-object-atoms>            |
| `escape-html`                   | 1.0.3   | MIT               | <https://github.com/component/escape-html>             |
| `etag`                          | 1.8.1   | MIT               | <https://github.com/jshttp/etag>                       |
| `express`                       | 4.22.3  | MIT               | <https://github.com/expressjs/express>                 |
| `finalhandler`                  | 1.3.2   | MIT               | <https://github.com/pillarjs/finalhandler>             |
| `forwarded`                     | 0.2.0   | MIT               | <https://github.com/jshttp/forwarded>                  |
| `fresh`                         | 0.5.2   | MIT               | <https://github.com/jshttp/fresh>                      |
| `function-bind`                 | 1.1.2   | MIT               | <https://github.com/Raynos/function-bind>              |
| `get-intrinsic`                 | 1.3.0   | MIT               | <https://github.com/ljharb/get-intrinsic>              |
| `get-proto`                     | 1.0.1   | MIT               | <https://github.com/ljharb/get-proto>                  |
| `gopd`                          | 1.2.0   | MIT               | <https://github.com/ljharb/gopd>                       |
| `has-symbols`                   | 1.1.0   | MIT               | <https://github.com/inspect-js/has-symbols>            |
| `hasown`                        | 2.0.4   | MIT               | <https://github.com/inspect-js/hasOwn>                 |
| `helmet`                        | 8.3.0   | MIT               | <https://github.com/helmetjs/helmet>                   |
| `http-errors`                   | 2.0.1   | MIT               | <https://github.com/jshttp/http-errors>                |
| `iconv-lite`                    | 0.4.24  | MIT               | <https://github.com/ashtuchkin/iconv-lite>             |
| `iconv-lite`                    | 0.6.3   | MIT               | <https://github.com/ashtuchkin/iconv-lite>             |
| `inherits`                      | 2.0.4   | ISC               | <https://github.com/isaacs/inherits>                   |
| `ipaddr.js`                     | 1.9.1   | MIT               | <https://github.com/whitequark/ipaddr.js>              |
| `math-intrinsics`               | 1.1.0   | MIT               | <https://github.com/es-shims/math-intrinsics>          |
| `media-typer`                   | 0.3.0   | MIT               | <https://github.com/jshttp/media-typer>                |
| `merge-descriptors`             | 1.0.3   | MIT               | <https://github.com/sindresorhus/merge-descriptors>    |
| `methods`                       | 1.1.2   | MIT               | <https://github.com/jshttp/methods>                    |
| `mime`                          | 1.6.0   | MIT               | <https://github.com/broofa/node-mime>                  |
| `mime-db`                       | 1.52.0  | MIT               | <https://github.com/jshttp/mime-db>                    |
| `mime-db`                       | 1.54.0  | MIT               | <https://github.com/jshttp/mime-db>                    |
| `mime-types`                    | 2.1.35  | MIT               | <https://github.com/jshttp/mime-types>                 |
| `ms`                            | 2.0.0   | MIT               | <https://github.com/zeit/ms>                           |
| `ms`                            | 2.1.3   | MIT               | <https://github.com/vercel/ms>                         |
| `negotiator`                    | 0.6.3   | MIT               | <https://github.com/jshttp/negotiator>                 |
| `negotiator`                    | 0.6.4   | MIT               | <https://github.com/jshttp/negotiator>                 |
| `object-assign`                 | 4.1.1   | MIT               | <https://github.com/sindresorhus/object-assign>        |
| `object-inspect`                | 1.13.4  | MIT               | <https://github.com/inspect-js/object-inspect>         |
| `on-exit-leak-free`             | 2.1.2   | MIT               | <https://github.com/mcollina/on-exit-or-gc>            |
| `on-finished`                   | 2.4.2   | MIT               | <https://github.com/jshttp/on-finished>                |
| `on-headers`                    | 1.1.0   | MIT               | <https://github.com/jshttp/on-headers>                 |
| `parseurl`                      | 1.3.3   | MIT               | <https://github.com/pillarjs/parseurl>                 |
| `path-to-regexp`                | 0.1.13  | MIT               | <https://github.com/pillarjs/path-to-regexp>           |
| `pino`                          | 9.14.0  | MIT               | <https://github.com/pinojs/pino>                       |
| `pino-abstract-transport`       | 2.0.0   | MIT               | <https://github.com/pinojs/pino-abstract-transport>    |
| `pino-std-serializers`          | 7.1.0   | MIT               | <https://github.com/pinojs/pino-std-serializers>       |
| `process-warning`               | 5.1.1   | MIT               | <https://github.com/fastify/process-warning>           |
| `proxy-addr`                    | 2.0.8   | MIT               | <https://github.com/jshttp/proxy-addr>                 |
| `qs`                            | 6.16.2  | BSD-3-Clause      | <https://github.com/ljharb/qs>                         |
| `quick-format-unescaped`        | 4.0.4   | MIT               | <https://github.com/davidmarkclements/quick-format>    |
| `range-parser`                  | 1.2.1   | MIT               | <https://github.com/jshttp/range-parser>               |
| `raw-body`                      | 2.5.3   | MIT               | <https://github.com/stream-utils/raw-body>             |
| `real-require`                  | 0.2.0   | MIT               | <https://github.com/pinojs/real-require>               |
| `safe-buffer`                   | 5.2.1   | MIT               | <https://github.com/feross/safe-buffer>                |
| `safe-stable-stringify`         | 2.5.0   | MIT               | <https://github.com/BridgeAR/safe-stable-stringify>    |
| `safer-buffer`                  | 2.1.2   | MIT               | <https://github.com/ChALkeR/safer-buffer>              |
| `semver`                        | 7.7.2   | ISC               | <https://github.com/npm/node-semver>                   |
| `semver`                        | 7.8.6   | ISC               | <https://github.com/npm/node-semver>                   |
| `send`                          | 0.19.2  | MIT               | <https://github.com/pillarjs/send>                     |
| `serve-static`                  | 1.16.3  | MIT               | <https://github.com/expressjs/serve-static>            |
| `setprototypeof`                | 1.2.0   | ISC               | <https://github.com/wesleytodd/setprototypeof>         |
| `sharp`                         | 0.35.5  | Apache-2.0        | <https://github.com/lovell/sharp>                      |
| `side-channel`                  | 1.1.1   | MIT               | <https://github.com/ljharb/side-channel>               |
| `side-channel-list`             | 1.0.1   | MIT               | <https://github.com/ljharb/side-channel-list>          |
| `side-channel-map`              | 1.0.1   | MIT               | <https://github.com/ljharb/side-channel-map>           |
| `side-channel-weakmap`          | 1.0.2   | MIT               | <https://github.com/ljharb/side-channel-weakmap>       |
| `sonic-boom`                    | 4.2.1   | MIT               | <https://github.com/pinojs/sonic-boom>                 |
| `split2`                        | 4.2.0   | ISC               | <https://github.com/mcollina/split2>                   |
| `statuses`                      | 2.0.2   | MIT               | <https://github.com/jshttp/statuses>                   |
| `thread-stream`                 | 3.2.0   | MIT               | <https://github.com/mcollina/thread-stream>            |
| `toidentifier`                  | 1.0.1   | MIT               | <https://github.com/component/toidentifier>            |
| `type-is`                       | 1.6.18  | MIT               | <https://github.com/jshttp/type-is>                    |
| `unpipe`                        | 1.0.0   | MIT               | <https://github.com/stream-utils/unpipe>               |
| `utils-merge`                   | 1.0.1   | MIT               | <https://github.com/jaredhanson/utils-merge>           |
| `vary`                          | 1.1.2   | MIT               | <https://github.com/jshttp/vary>                       |
| `zod`                           | 4.6.7   | MIT               | <https://github.com/colinhacks/zod>                    |

## Web interface dependencies

These packages are compiled into the web interface (`dist/`) (37 packages).

| Package                      | Version | License    | Source                                                    |
| ---------------------------- | ------- | ---------- | --------------------------------------------------------- |
| `@angular/common`            | 21.2.26 | MIT        | <https://github.com/angular/angular>                      |
| `@angular/compiler`          | 21.2.26 | MIT        | <https://github.com/angular/angular>                      |
| `@angular/core`              | 21.2.26 | MIT        | <https://github.com/angular/angular>                      |
| `@angular/platform-browser`  | 21.2.26 | MIT        | <https://github.com/angular/angular>                      |
| `@ngx-translate/core`        | 18.1.0  | MIT        | <https://github.com/ngx-translate/core>                   |
| `@ngx-translate/http-loader` | 18.1.0  | MIT        | <https://github.com/ngx-translate/core>                   |
| `ansi-regex`                 | 5.0.1   | MIT        | <https://github.com/chalk/ansi-regex>                     |
| `ansi-styles`                | 4.3.0   | MIT        | <https://github.com/chalk/ansi-styles>                    |
| `camelcase`                  | 5.3.1   | MIT        | <https://github.com/sindresorhus/camelcase>               |
| `cliui`                      | 6.0.0   | ISC        | <https://github.com/yargs/cliui>                          |
| `color-convert`              | 2.0.1   | MIT        | <https://github.com/Qix-/color-convert>                   |
| `color-name`                 | 1.1.4   | MIT        | <https://github.com/colorjs/color-name>                   |
| `decamelize`                 | 1.2.0   | MIT        | <https://github.com/sindresorhus/decamelize>              |
| `dijkstrajs`                 | 1.0.3   | MIT        | <https://github.com/tcort/dijkstrajs>                     |
| `emoji-regex`                | 8.0.0   | MIT        | <https://github.com/mathiasbynens/emoji-regex>            |
| `find-up`                    | 4.1.0   | MIT        | <https://github.com/sindresorhus/find-up>                 |
| `get-caller-file`            | 2.0.5   | ISC        | <https://github.com/stefanpenner/get-caller-file>         |
| `is-fullwidth-code-point`    | 3.0.0   | MIT        | <https://github.com/sindresorhus/is-fullwidth-code-point> |
| `locate-path`                | 5.0.0   | MIT        | <https://github.com/sindresorhus/locate-path>             |
| `p-limit`                    | 2.3.0   | MIT        | <https://github.com/sindresorhus/p-limit>                 |
| `p-locate`                   | 4.1.0   | MIT        | <https://github.com/sindresorhus/p-locate>                |
| `p-try`                      | 2.2.0   | MIT        | <https://github.com/sindresorhus/p-try>                   |
| `path-exists`                | 4.0.0   | MIT        | <https://github.com/sindresorhus/path-exists>             |
| `pngjs`                      | 5.0.0   | MIT        | <https://github.com/lukeapage/pngjs>                      |
| `qrcode`                     | 1.5.4   | MIT        | <https://github.com/soldair/node-qrcode>                  |
| `require-directory`          | 2.1.1   | MIT        | <https://github.com/troygoode/node-require-directory>     |
| `require-main-filename`      | 2.0.0   | ISC        | <https://github.com/yargs/require-main-filename>          |
| `rxjs`                       | 7.8.2   | Apache-2.0 | <https://github.com/reactivex/rxjs>                       |
| `set-blocking`               | 2.0.0   | ISC        | <https://github.com/yargs/set-blocking>                   |
| `string-width`               | 4.2.3   | MIT        | <https://github.com/sindresorhus/string-width>            |
| `strip-ansi`                 | 6.0.1   | MIT        | <https://github.com/chalk/strip-ansi>                     |
| `tslib`                      | 2.9.1   | 0BSD       | <https://github.com/Microsoft/tslib>                      |
| `which-module`               | 2.0.1   | ISC        | <https://github.com/nexdrew/which-module>                 |
| `wrap-ansi`                  | 6.2.0   | MIT        | <https://github.com/chalk/wrap-ansi>                      |
| `y18n`                       | 4.0.3   | ISC        | <https://github.com/yargs/y18n>                           |
| `yargs`                      | 15.4.1  | MIT        | <https://github.com/yargs/yargs>                          |
| `yargs-parser`               | 18.1.3  | ISC        | <https://github.com/yargs/yargs-parser>                   |

_Generated from the installed production dependencies with `license-checker-rseidelsohn --production`. Regenerate it when the dependencies change._
