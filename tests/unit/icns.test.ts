import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeIcns, encodeIcns, pngSize } from '../../scripts/icns.ts';

const png = (width: number, height: number): Buffer => {
  const buf = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(buf);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
};

test('icns: entries are written and read back with the right lengths', () => {
  const file = encodeIcns([
    { type: 'icp4', data: png(16, 16) },
    { type: 'ic10', data: png(1024, 1024) },
  ]);
  assert.equal(file.toString('latin1', 0, 4), 'icns');
  assert.equal(file.readUInt32BE(4), file.length);
  const entries = decodeIcns(file);
  assert.deepEqual(
    entries.map((entry) => [entry.type, pngSize(entry.data)]),
    [
      ['icp4', { width: 16, height: 16 }],
      ['ic10', { width: 1024, height: 1024 }],
    ],
  );
});

test('icns: damaged files and bad types are refused', () => {
  assert.throws(() => encodeIcns([{ type: 'toolong', data: png(1, 1) }]), /bad entry type/);
  assert.throws(() => decodeIcns(Buffer.from('nope0000')), /not an icns/);
  const file = encodeIcns([{ type: 'ic07', data: png(128, 128) }]);
  assert.throws(() => decodeIcns(file.subarray(0, file.length - 1)), /length/);
  assert.equal(pngSize(Buffer.from('not a png at all, really not')), null);
});
