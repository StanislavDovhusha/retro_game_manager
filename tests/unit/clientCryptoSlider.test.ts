import '../helpers/env.ts';
import '../helpers/clientAlias.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface SliderLogic {
  withAddress<T extends { address: string }>(coins: readonly T[]): T[];
  wrapIndex(index: number, step: number, count: number): number;
  swipeStep(dx: number, width: number, durationMs: number): -1 | 0 | 1;
  qrShape(text: string): { size: number; path: string; viewBox: number };
}
interface Config {
  DONATE_CRYPTO: readonly { id: string; ticker: string; network: string; address: string }[];
}
const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/app/features/donate');
const logic = (await import(pathToFileURL(path.join(client, 'crypto-slider/crypto-slider.logic.ts')).href)) as SliderLogic;
const config = (await import(pathToFileURL(path.join(client, 'donate.config.ts')).href)) as Config;

test('crypto config: the coins, each with its network; coins without an address are not shown', () => {
  assert.deepEqual(
    config.DONATE_CRYPTO.map((coin) => `${coin.ticker} ${coin.network}`),
    [
      'BTC Bitcoin',
      'ETH Ethereum',
      'USDT TRON (TRC-20)',
      'USDC Ethereum (ERC-20)',
      'SOL Solana',
      'BNB BNB Smart Chain (BEP-20)',
      'DASH Dash',
      'LTC Litecoin',
      'TRX TRON',
      'TON TON',
      'DOGE Dogecoin',
    ],
  );
  const coins = [{ address: 'bc1q' }, { address: '' }, { address: '   ' }, { address: 'T9z' }];
  assert.deepEqual(logic.withAddress(coins), [{ address: 'bc1q' }, { address: 'T9z' }]);
});

test('crypto slider: the ends wrap around', () => {
  assert.equal(logic.wrapIndex(0, -1, 4), 3);
  assert.equal(logic.wrapIndex(3, 1, 4), 0);
  assert.equal(logic.wrapIndex(1, 1, 4), 2);
  assert.equal(logic.wrapIndex(0, 1, 0), 0);
});

test('crypto slider: a swipe needs distance or speed; left shows the next coin', () => {
  assert.equal(logic.swipeStep(-100, 400, 600), 1);
  assert.equal(logic.swipeStep(100, 400, 600), -1);
  assert.equal(logic.swipeStep(-30, 400, 600), 0, 'too short and slow');
  assert.equal(logic.swipeStep(-30, 400, 120), 1, 'a flick');
  assert.equal(logic.swipeStep(-10, 400, 50), 0, 'a tap is not a flick');
});

test('crypto slider: the QR code is drawn locally, one square per dark module, with a quiet zone', () => {
  const qr = logic.qrShape('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
  assert.equal((qr.size - 17) % 4, 0, 'a QR size is 4 × version + 17');
  assert.equal(qr.viewBox, qr.size + 4);
  assert.ok(qr.path.startsWith('M2 2h1v1h-1z'), 'the top-left finder pattern starts at the quiet zone');
  const squares = qr.path.match(/M/g)?.length ?? 0;
  assert.ok(squares > qr.size * qr.size * 0.3 && squares < qr.size * qr.size * 0.7, `${squares} dark modules`);
  assert.notEqual(logic.qrShape('0x0000000000000000000000000000000000000001').path, qr.path);
});
