/**
 * Lightweight, zero-dependency video container patchers to remove audio tracks and metadata.
 * Modifies the underlying ArrayBuffer in-place.
 */
export class VideoStripper {
  static async stripAudio(file: File): Promise<File> {
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const view = new DataView(buffer);

      let patched = false;
      if (file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')) {
        patched = this.stripMp4(uint8, view);
      } else if (file.type === 'video/webm' || file.name.toLowerCase().endsWith('.webm')) {
        patched = this.stripWebm(uint8);
      }

      if (patched) {
        return new File([buffer], file.name, { type: file.type });
      }
    } catch (error) {
      console.warn('Failed to strip audio from video:', error);
    }
    return file;
  }

  static async stripMetadata(file: File): Promise<File> {
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const view = new DataView(buffer);

      let patched = false;
      if (file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')) {
        patched = this.stripMp4Metadata(uint8, view);
      }

      if (patched) {
        return new File([buffer], file.name, { type: file.type });
      }
    } catch (error) {
      console.warn('Failed to strip metadata from video:', error);
    }
    return file;
  }

  private static stripMp4(uint8: Uint8Array, view: DataView): boolean {
    let offset = 0;
    let stripped = false;
    const utf8Decoder = new TextDecoder('utf8');

    while (offset + 8 <= uint8.length) {
      let size = view.getUint32(offset, false);
      let boxOffset = offset;

      if (size === 1) {
        if (offset + 16 > uint8.length) break;
        // 64-bit size; lower 32 bits are enough for the sizes we handle here.
        size = view.getUint32(offset + 12, false);
        boxOffset += 8;
      } else if (size === 0) {
        size = uint8.length - offset;
      }

      if (size < 8) break;
      const boxEnd = offset + size;
      if (boxEnd > uint8.length) break;

      const type = utf8Decoder.decode(uint8.subarray(boxOffset + 4, boxOffset + 8));
      if (type !== 'moov') {
        offset = boxEnd;
        continue;
      }

      let moovOffset = boxOffset + 8;
      const moovEnd = boxEnd;
      while (moovOffset + 8 <= moovEnd) {
        let boxSize = view.getUint32(moovOffset, false);
        if (boxSize === 0) {
          boxSize = moovEnd - moovOffset;
        }
        if (boxSize < 8 || (moovOffset + boxSize > moovEnd)) break;

        const boxType = utf8Decoder.decode(uint8.subarray(moovOffset + 4, moovOffset + 8));
        if (boxType === 'trak') {
          let isAudio = false;
          let trakOffset = moovOffset + 8;
          const trakEnd = moovOffset + boxSize;

          while (trakOffset + 8 <= trakEnd) {
            let tBoxSize = view.getUint32(trakOffset, false);
            if (tBoxSize === 0) {
              tBoxSize = trakEnd - trakOffset;
            }
            if (tBoxSize < 8 || (trakOffset + tBoxSize > trakEnd)) break;

            const tBoxType = utf8Decoder.decode(uint8.subarray(trakOffset + 4, trakOffset + 8));
            if (tBoxType === 'mdia') {
              let mdiaOffset = trakOffset + 8;
              const mdiaEnd = trakOffset + tBoxSize;
              while (mdiaOffset + 8 <= mdiaEnd) {
                let mBoxSize = view.getUint32(mdiaOffset, false);
                if (mBoxSize === 0) {
                  mBoxSize = mdiaEnd - mdiaOffset;
                }
                if (mBoxSize < 8 || (mdiaOffset + mBoxSize > mdiaEnd)) break;

                const mBoxType = utf8Decoder.decode(uint8.subarray(mdiaOffset + 4, mdiaOffset + 8));
                if (mBoxType === 'hdlr' && mdiaOffset + 20 <= mdiaEnd) {
                  const handlerType = utf8Decoder.decode(uint8.subarray(mdiaOffset + 16, mdiaOffset + 20));
                  if (handlerType === 'soun') {
                    isAudio = true;
                    break;
                  }
                }
                mdiaOffset += mBoxSize;
              }
            }
            trakOffset += tBoxSize;
          }

          if (isAudio) {
            // Replace `trak` with `free` to keep box sizes intact while dropping the track from use.
            uint8[moovOffset + 4] = 0x66; // f
            uint8[moovOffset + 5] = 0x72; // r
            uint8[moovOffset + 6] = 0x65; // e
            uint8[moovOffset + 7] = 0x65; // e
            stripped = true;
          }
        }

        moovOffset += boxSize;
      }

      offset = boxEnd;
    }

    return stripped;
  }

  private static stripWebm(uint8: Uint8Array): boolean {
    let offset = 0;
    let stripped = false;

    const readVint = (off: number): { val: number, length: number } => {
      if (off >= uint8.length) return { val: 0, length: 1 };
      const first = uint8[off];
      let mask = 0x80;
      let length = 1;
      while (!(first & mask) && length < 8) {
        mask >>= 1;
        length++;
      }
      let val = first & ~mask;
      for (let i = 1; i < length; i++) {
        if (off + i >= uint8.length) break;
        val = (val << 8) | uint8[off + i];
      }
      return { val, length };
    };

    const skipEbmlElement = (from: number): number => {
      if (from >= uint8.length) return uint8.length;
      let idLength = 1;
      while (idLength < 8 && !(uint8[from] & (0x80 >> (idLength - 1)))) {
        idLength++;
      }
      const sizeInfo = readVint(from + idLength);
      return from + idLength + sizeInfo.length + sizeInfo.val;
    };

    while (offset + 4 <= uint8.length) {
      // EBML header
      if (uint8[offset] === 0x1A && uint8[offset + 1] === 0x45 && uint8[offset + 2] === 0xDF && uint8[offset + 3] === 0xA3) {
        const sizeInfo = readVint(offset + 4);
        offset += 4 + sizeInfo.length + sizeInfo.val;
        continue;
      }

      // Segment
      if (!(uint8[offset] === 0x18 && uint8[offset + 1] === 0x53 && uint8[offset + 2] === 0x80 && uint8[offset + 3] === 0x67)) {
        break;
      }

      const sizeInfo = readVint(offset + 4);
      offset += 4 + sizeInfo.length;
      const segmentEnd = offset + sizeInfo.val;

      while (offset + 4 <= segmentEnd && offset + 4 <= uint8.length) {
        // Tracks
        if (uint8[offset] === 0x16 && uint8[offset + 1] === 0x54 && uint8[offset + 2] === 0xAE && uint8[offset + 3] === 0x6B) {
          const tracksSizeInfo = readVint(offset + 4);
          let tracksOffset = offset + 4 + tracksSizeInfo.length;
          const tracksEnd = tracksOffset + tracksSizeInfo.val;

          while (tracksOffset < tracksEnd && tracksOffset < uint8.length) {
            if (uint8[tracksOffset] === 0xAE) {
              const entryStart = tracksOffset;
              const entrySizeInfo = readVint(tracksOffset + 1);
              const entryDataOffset = tracksOffset + 1 + entrySizeInfo.length;
              const entryEnd = entryDataOffset + entrySizeInfo.val;

              let isAudio = false;
              let curr = entryDataOffset;
              while (curr < entryEnd && curr < uint8.length) {
                if (uint8[curr] === 0x83) {
                  const typeSizeInfo = readVint(curr + 1);
                  const typeValInfo = readVint(curr + 1 + typeSizeInfo.length);
                  if (typeValInfo.val === 2) {
                    isAudio = true;
                    break;
                  }
                  curr += 1 + typeSizeInfo.length + typeSizeInfo.val;
                } else {
                  curr = skipEbmlElement(curr);
                }
              }

              if (isAudio) {
                // Replace TrackEntry with Void.
                uint8[entryStart] = 0xEC;
                stripped = true;
              }
              tracksOffset = entryEnd;
            } else {
              tracksOffset = skipEbmlElement(tracksOffset);
            }
          }

          offset = tracksEnd;
        } else {
          offset = skipEbmlElement(offset);
        }
      }
    }

    return stripped;
  }

  private static stripMp4Metadata(uint8: Uint8Array, view: DataView): boolean {
    const utf8Decoder = new TextDecoder('utf8');
    const removable = new Set(['udta', 'meta', 'ilst']);
    const containers = new Set([
      'moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex', 'moof', 'traf', 'mfra', 'skip'
    ]);

    let stripped = false;
    const ranges = [{ start: 0, end: uint8.length }];

    while (ranges.length) {
      const range = ranges.pop();
      let offset = range.start;
      while (offset + 8 <= range.end) {
        let size = view.getUint32(offset, false);
        let boxOffset = offset;

        if (size === 1) {
          if (offset + 16 > range.end) { break; }
          // 64-bit size; lower 32 bits are enough for the sizes we handle here.
          size = view.getUint32(offset + 12, false);
          boxOffset += 8;
        } else if (size === 0) {
          size = range.end - offset;
        }

        if (size < 8) { break; }
        const boxEnd = offset + size;
        if (boxEnd > range.end) { break; }

        const type = utf8Decoder.decode(uint8.subarray(boxOffset + 4, boxOffset + 8));
        if (removable.has(type)) {
          uint8[boxOffset + 4] = 0x66; // f
          uint8[boxOffset + 5] = 0x72; // r
          uint8[boxOffset + 6] = 0x65; // e
          uint8[boxOffset + 7] = 0x65; // e
          stripped = true;
        } else if (containers.has(type)) {
          let childOffset = boxOffset + 8;
          if (type === 'meta') {
            childOffset += 4; // FullBox version/flags
          }
          if (childOffset + 8 <= boxEnd) {
            ranges.push({ start: childOffset, end: boxEnd });
          }
        }

        offset = boxEnd;
      }
    }

    return stripped;
  }
}
