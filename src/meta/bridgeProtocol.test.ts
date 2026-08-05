import { describe, expect, it } from 'vitest';
import { decodeDetail, encodeDetail, BRIDGE_REQUEST } from './bridgeProtocol';

describe('bridgeProtocol', () => {
  it('round-trips a request through encode and decode', () => {
    const req = { id: 3, type: 'storageGet', area: 'sync', keys: ['a', 'b'] };
    const ev = new CustomEvent(BRIDGE_REQUEST, { detail: encodeDetail(req) });
    expect(decodeDetail(ev)).toEqual(req);
  });

  it('round-trips null keys', () => {
    const req = { id: 0, type: 'storageGet', area: 'local', keys: null };
    const ev = new CustomEvent(BRIDGE_REQUEST, { detail: encodeDetail(req) });
    expect(decodeDetail(ev)).toEqual(req);
  });
});
