// GPG4Browsers - An OpenPGP implementation in javascript
// Copyright (C) 2011 Recurity Labs GmbH
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 3.0 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

import { isArrayStream, passiveClone as streamPassiveClone, parse as streamParse, readToEnd as streamReadToEnd } from '@cyberclarence/web-stream-tools';
import enums from '../enums';
import util from '../util';

/**
 * Implementation of the Literal Data Packet (Tag 11)
 *
 * {@link https://tools.ietf.org/html/rfc4880#section-5.9|RFC4880 5.9}:
 * A Literal Data packet contains the body of a message; data that is not to be
 * further interpreted.
 */
class LiteralDataPacket {
  static get tag() {
    return enums.packet.literalData;
  }

  /**
   * @param {Date} date - The creation date of the literal package
   */
  constructor(date = new Date()) {
    this.format = enums.literal.utf8; // default format for literal data packets
    this.date = util.normalizeDate(date);
    this.text = null; // textual data representation
    this.data = null; // literal data representation
    this.filename = '';
  }

  /**
   * Set the packet data to a javascript native string, end of line
   * will be normalized to \r\n and by default text is converted to UTF8
   * @param {String | ReadableStream<String>} text - Any native javascript string
   * @param {enums.literal} [format] - The format of the string of bytes
   */
  setText(text, format = enums.literal.utf8) {
    this.format = format;
    this.text = text;
    this.data = null;
  }

  /**
   * Returns literal data packets as native JavaScript string
   * with normalized end of line to \n
   * @param {Boolean} [clone] - Whether to return a clone so that getBytes/getText can be called again
   * @returns {String | ReadableStream<String>} Literal data as text.
   */
  getText(clone = false) {
    if (this.text === null || util.isStream(this.text)) { // Assume that this.text has been read
      this.text = util.decodeUTF8(util.nativeEOL(this.getBytes(clone)));
    }
    return this.text;
  }

  /**
   * Set the packet data to value represented by the provided string of bytes.
   * @param {Uint8Array | ReadableStream<Uint8Array>} bytes - The string of bytes
   * @param {enums.literal} format - The format of the string of bytes
   */
  setBytes(bytes, format) {
    this.format = format;
    this.data = bytes;
    this.text = null;
  }


  /**
   * Get the byte sequence representing the literal packet data
   * @param {Boolean} [clone] - Whether to return a clone so that getBytes/getText can be called again
   * @returns {Uint8Array | ReadableStream<Uint8Array>} A sequence of bytes.
   */
  getBytes(clone = false) {
    if (this.data === null) {
      // encode UTF8 and normalize EOL to \r\n
      this.data = util.canonicalizeEOL(util.encodeUTF8(this.text));
    }
    if (clone) {
      return streamPassiveClone(this.data);
    }
    return this.data;
  }


  /**
   * Sets the filename of the literal packet data
   * @param {String} filename - Any native javascript string
   */
  setFilename(filename) {
    this.filename = filename;
  }


  /**
   * Get the filename of the literal packet data
   * @returns {String} Filename.
   */
  getFilename() {
    return this.filename;
  }

  /**
   * Parsing function for a literal data packet (tag 11).
   *
   * @param {Uint8Array | ReadableStream<Uint8Array>} input - Payload of a tag 11 packet
   * @returns {Promise<LiteralDataPacket>} Object representation.
   * @async
   */
  async read(bytes) {
    await streamParse(bytes, async reader => {
      // - A one-octet field that describes how the data is formatted.
      const format = await reader.readByte(); // enums.literal

      const filename_len = await reader.readByte();
      this.filename = util.decodeUTF8(await reader.readBytes(filename_len));

      this.date = util.readDate(await reader.readBytes(4));

      let data = reader.remainder();
      if (isArrayStream(data)) data = await streamReadToEnd(data);
      this.setBytes(data, format);
    });
  }

  /**
   * Creates a Uint8Array representation of the packet, excluding the data
   *
   * @returns {Uint8Array} Uint8Array representation of the packet.
   */
  writeHeader() {
    const filename = util.encodeUTF8(this.filename);
    const filename_length = new Uint8Array([filename.length]);

    const format = new Uint8Array([this.format]);
    const date = util.writeDate(this.date);

    return util.concatUint8Array([format, filename_length, filename, date]);
  }

  /**
   * Creates a Uint8Array representation of the packet
   *
   * @returns {Uint8Array | ReadableStream<Uint8Array>} Uint8Array representation of the packet.
   */
  write() {
    const header = this.writeHeader();
    const data = this.getBytes();

    return util.concat([header, data]);
  }
}

export default LiteralDataPacket;
