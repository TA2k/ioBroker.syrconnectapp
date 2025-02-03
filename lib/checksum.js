const xmljs = require('xml-js');

/**
 * Checksum calculation class for generating a unique hash from input strings.
 * Now includes XML parsing using xml-js.
 */
class Checksum {
  /**
   * Initializes the checksum calculator.
   * @param {string} baseCharacters - A string representing the character set used for encoding.
   * @param {string} key - A keyword used in the encoding process.
   */
  constructor(baseCharacters, key) {
    this.baseCharacters = baseCharacters;
    this.key = key;
    this.checksumValue = 0;
  }

  /**
   * Extracts a subset of bits from a byte.
   * @param {number} byte - The byte to extract bits from.
   * @param {number} start - The starting bit position.
   * @param {number} length - The number of bits to extract.
   * @returns {number} - Extracted bits as a number.
   */
  static extractBits(byte, start, length) {
    return (byte >> start) & ((1 << length) - 1);
  }

  /**
   * Computes a checksum-compatible numeric value from the input string.
   * @param {string} value - The input string to process.
   * @returns {number} - Computed numeric checksum contribution.
   */
  computeChecksumValue(value) {
    const normalized = (value || '').trim();
    if (!normalized) return 0;

    // Convert the normalized string to bytes (UTF-8)
    const buf = Buffer.from(normalized, 'utf8');
    const bytes = Array.from(buf); // array of numbers in 0..255

    // Calculate how many 5-bit chunks are available
    const totalBits = bytes.length * 8;
    const numChunks = Math.ceil(totalBits / 5);

    let contribution = 0;
    let bitOffset = 0; // corresponds to variable i5 in the Java code
    let byteIndex = 0; // corresponds to variable i6

    // Process each 5-bit chunk (i7 = chunkIndex)
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      if (bitOffset >= 8) {
        byteIndex++;
        bitOffset = bitOffset % 8;
      }
      // Get the current byte (or 0 if out-of-range)
      const currentByte = byteIndex < bytes.length ? bytes[byteIndex] : 0;
      // Simulate: C3496a.m20755g(byte, i5) ==> (byte << bitOffset)
      let shifted = (currentByte << bitOffset) & 0xff; // keep only 8 bits

      // If i5 (bitOffset) > 3, we need bits from the next byte
      if (bitOffset > 3) {
        const nextByte = byteIndex + 1 < bytes.length ? bytes[byteIndex + 1] : 0;
        // Simulate: m20759k(nextByte, 8 - (i5 - 3))
        // That is, right-shift the nextByte by (8 - (bitOffset - 3))
        const shiftAmt = 8 - (bitOffset - 3);
        const nextPart = ((nextByte >>> shiftAmt) << 3) & 0xff;
        shifted = shifted | nextPart;
      }
      // Now simulate: m20759k(shifted, 3) i.e. unsigned right shift by 3.
      const fiveBitValue = shifted >>> 3; // this is the extracted 5-bit chunk (0..31)

      // Use the secret keys:
      // this.baseCharacters is f5150a; key2 is f5151b.
      // Get an offset: take this.key.charAt(chunkIndex mod this.key.length) and find its index in this.baseCharacters.
      const key2Char = this.key.charAt(chunkIndex % this.key.length);
      let offset = this.baseCharacters.indexOf(key2Char);
      if (offset < 0) offset = 0; // safeguard

      let sum = fiveBitValue + offset;
      // If the sum is greater than or equal to this.baseCharacters's length, wrap it:
      if (sum >= this.baseCharacters.length) {
        sum = sum - this.baseCharacters.length + 1;
      }
      // Look up the character from this.baseCharacters at the computed index
      // and add its unsigned value (its char code masked to 0xff) to the contribution.
      contribution += this.baseCharacters.charCodeAt(sum) & 0xff;

      // Advance the bit offset by 5 for the next chunk.
      bitOffset += 5;
    }
    return contribution;
  }

  /**
   * Adds a string's computed value to the checksum total.
   * @param {string} input - The input string to process.
   */
  addToChecksum(input) {
    this.checksumValue += this.computeChecksumValue(input);
  }

  /**
   * Parses an XML string, extracts all attribute values, and adds them to the checksum.
   * @param {string} xmlString - The XML string to process.
   */
  addXmlToChecksum(xmlString) {
    try {
      const json = xmljs.xml2js(xmlString, { compact: true, ignoreDeclaration: true });
      const values = [];

      function extractValues(obj) {
        for (const key in obj) {
          if (typeof obj[key] === 'object') {
            extractValues(obj[key]); // Recursively extract values
          } else {
            if (key !== 'n') {
              values.push(obj[key]); // Add attribute values
            }
          }
        }
      }

      extractValues(json);

      // Add each extracted value to the checksum calculation
      values.forEach((value) => this.addToChecksum(value));
    } catch (error) {
      console.error('Error parsing XML:', error);
    }
  }

  /**
   * Resets the checksum to zero.
   */
  resetChecksum() {
    this.checksumValue = 0;
  }

  /**
   * Returns the computed checksum as a hexadecimal string.
   * @returns {string} - Checksum value in uppercase hexadecimal.
   */
  getChecksum() {
    return this.checksumValue.toString(16).toUpperCase();
  }

  /**
   * Manually sets the checksum value from a hex string.
   * @param {string} hexString - Hexadecimal string representation of the checksum.
   */
  setChecksum(hexString) {
    this.checksumValue = parseInt(hexString, 16);
  }
}

module.exports = Checksum;
