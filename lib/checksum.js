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
   * @param {string} input - The input string to process.
   * @returns {number} - Computed numeric checksum contribution.
   */
  computeChecksumValue(input) {
    if (!input) return 0;

    const inputBytes = Buffer.from(input, 'utf8');
    const totalIterations = Math.ceil((inputBytes.length * 8) / 5);
    let checksumSum = 0;
    let bitIndex = 0;
    let byteIndex = 0;

    for (let i = 0; i < totalIterations; i++) {
      if (bitIndex >= 8) {
        byteIndex++;
        bitIndex %= 8;
      }

      let extractedBits = Checksum.extractBits(inputBytes[byteIndex], bitIndex, 5);

      if (bitIndex > 3 && byteIndex + 1 < inputBytes.length) {
        extractedBits |= Checksum.extractBits(inputBytes[byteIndex + 1], 0, 8 - (bitIndex - 3));
      }

      const keyChar = this.key[i % this.key.length];
      const keyOffset = this.baseCharacters.indexOf(keyChar);
      let modifiedIndex = extractedBits + keyOffset;

      if (modifiedIndex >= this.baseCharacters.length) {
        modifiedIndex = modifiedIndex - this.baseCharacters.length + 1;
      }

      checksumSum += this.baseCharacters.charCodeAt(modifiedIndex);
      bitIndex += 5;
    }

    return checksumSum;
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
            values.push(obj[key]); // Add attribute values
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
