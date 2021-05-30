/**
 * Adopted from https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/color.js
 * which is licensed as follows:
 *
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export class Color {
  readonly _originalTextIsValid: boolean;
  private _hsla?: Array<number>;

  constructor(
    readonly _rgba: Array<number>,
    readonly _format: string,
    readonly _originalText: string | null,
  ) {
    this._originalTextIsValid = !!this._originalText;
    if (typeof this._rgba[3] === "undefined") {
      this._rgba[3] = 1;
    }

    for (let i = 0; i < 4; ++i) {
      if (this._rgba[i] < 0) {
        this._rgba[i] = 0;
        this._originalTextIsValid = false;
      }
      if (this._rgba[i] > 1) {
        this._rgba[i] = 1;
        this._originalTextIsValid = false;
      }
    }
  }

  static parse(text: string): Color | null {
    const value = text.toLowerCase().replace(/\s+/g, "");
    const simple = /^(?:#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8}))$/i;
    let match = value.match(simple);
    if (match) {
      if (match[1]) { // hex
        let hex = match[1].toLowerCase();
        let format;
        if (hex.length === 3) {
          format = Color.Format.ShortHEX;
          hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) +
            hex.charAt(2) + hex.charAt(2);
        } else if (hex.length === 4) {
          format = Color.Format.ShortHEXA;
          hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) +
            hex.charAt(2) + hex.charAt(2) +
            hex.charAt(3) + hex.charAt(3);
        } else if (hex.length === 6) {
          format = Color.Format.HEX;
        } else {
          format = Color.Format.HEXA;
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        let a = 1;
        if (hex.length === 8) {
          a = parseInt(hex.substring(6, 8), 16) / 255;
        }
        return new Color([r / 255, g / 255, b / 255, a], format, text);
      }

      return null;
    }

    // rgb/rgba(), hsl/hsla()
    match = text.toLowerCase().match(/^\s*(?:(rgba?)|(hsla?))\((.*)\)\s*$/);

    if (match) {
      const components = match[3].trim();
      let values = components.split(/\s*,\s*/);
      if (values.length === 1) {
        values = components.split(/\s+/);
        if (values[3] === "/") {
          values.splice(3, 1);
          if (values.length !== 4) {
            return null;
          }
        } else if (
          (values.length > 2 && values[2].indexOf("/") !== -1) ||
          (values.length > 3 && values[3].indexOf("/") !== -1)
        ) {
          const alpha = values.slice(2, 4).join("");
          values = values.slice(0, 2).concat(alpha.split(/\//)).concat(
            values.slice(4),
          );
        } else if (values.length >= 4) {
          return null;
        }
      }
      if (
        values.length !== 3 && values.length !== 4 || values.indexOf("") > -1
      ) {
        return null;
      }
      const hasAlpha = (values[3] !== undefined);

      if (match[1]) { // rgb/rgba
        const rgba = [
          Color._parseRgbNumeric(values[0]),
          Color._parseRgbNumeric(values[1]),
          Color._parseRgbNumeric(values[2]),
          hasAlpha ? Color._parseAlphaNumeric(values[3]) : 1,
        ];
        if (rgba.indexOf(null) > -1) {
          return null;
        }
        return new Color(
          rgba as number[],
          hasAlpha ? Color.Format.RGBA : Color.Format.RGB,
          text,
        );
      }

      if (match[2]) { // hsl/hsla
        const hsla = [
          Color._parseHueNumeric(values[0]),
          Color._parseSatLightNumeric(values[1]),
          Color._parseSatLightNumeric(values[2]),
          hasAlpha ? Color._parseAlphaNumeric(values[3]) : 1,
        ];
        if (hsla.indexOf(null) > -1) {
          return null;
        }
        const rgba = [] as number[];
        Color.hsl2rgb(hsla as number[], rgba);
        return new Color(
          rgba,
          hasAlpha ? Color.Format.HSLA : Color.Format.HSL,
          text,
        );
      }
    }

    return null;
  }

  private static _parsePercentOrNumber(value: string): number | null {
    if (isNaN(Number(value.replace("%", "")))) {
      return null;
    }
    const parsed = parseFloat(value);

    if (value.indexOf("%") !== -1) {
      if (value.indexOf("%") !== value.length - 1) {
        return null;
      }
      return parsed / 100;
    }
    return parsed;
  }

  private static _parseRgbNumeric(value: string): number | null {
    const parsed = Color._parsePercentOrNumber(value);
    if (parsed === null) {
      return null;
    }

    if (value.indexOf("%") !== -1) {
      return parsed;
    }
    return parsed / 255;
  }

  private static _parseHueNumeric(value: string): number | null {
    const angle = value.replace(/(deg|g?rad|turn)$/, "");
    if (isNaN(Number(angle)) || value.match(/\s+(deg|g?rad|turn)/)) {
      return null;
    }
    const number = parseFloat(angle);

    if (value.indexOf("turn") !== -1) {
      return number % 1;
    } else if (value.indexOf("grad") !== -1) {
      return (number / 400) % 1;
    } else if (value.indexOf("rad") !== -1) {
      return (number / (2 * Math.PI)) % 1;
    }
    return (number / 360) % 1;
  }

  private static _parseSatLightNumeric(value: string): number | null {
    if (
      value.indexOf("%") !== value.length - 1 ||
      isNaN(Number(value.replace("%", "")))
    ) {
      return null;
    }
    const parsed = parseFloat(value);
    return Math.min(1, parsed / 100);
  }

  static _parseAlphaNumeric(value: string): number | null {
    return Color._parsePercentOrNumber(value);
  }

  static hsl2rgb(hsl: Array<number>, outRgb: Array<number>): void {
    const h = hsl[0];
    let s = hsl[1];
    const l = hsl[2];

    function hue2rgb(p: number, q: number, h: number): number {
      if (h < 0) {
        h += 1;
      } else if (h > 1) {
        h -= 1;
      }

      if ((h * 6) < 1) {
        return p + (q - p) * h * 6;
      } else if ((h * 2) < 1) {
        return q;
      } else if ((h * 3) < 2) {
        return p + (q - p) * ((2 / 3) - h) * 6;
      } else {
        return p;
      }
    }

    if (s < 0) {
      s = 0;
    }

    let q;
    if (l <= 0.5) {
      q = l * (1 + s);
    } else {
      q = l + s - (l * s);
    }

    const p = 2 * l - q;

    const tr = h + (1 / 3);
    const tg = h;
    const tb = h - (1 / 3);

    outRgb[0] = hue2rgb(p, q, tr);
    outRgb[1] = hue2rgb(p, q, tg);
    outRgb[2] = hue2rgb(p, q, tb);
    outRgb[3] = hsl[3];
  }

  format(): string {
    return this._format;
  }

  /**
   * @return HSLA with components within [0..1]
   */
  hsla(): Array<number> {
    if (this._hsla) {
      return this._hsla;
    }
    const r = this._rgba[0];
    const g = this._rgba[1];
    const b = this._rgba[2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const add = max + min;

    let h;
    if (min === max) {
      h = 0;
    } else if (r === max) {
      h = ((1 / 6 * (g - b) / diff) + 1) % 1;
    } else if (g === max) {
      h = (1 / 6 * (b - r) / diff) + 1 / 3;
    } else {
      h = (1 / 6 * (r - g) / diff) + 2 / 3;
    }

    const l = 0.5 * add;

    let s;
    if (l === 0) {
      s = 0;
    } else if (l === 1) {
      s = 0;
    } else if (l <= 0.5) {
      s = diff / add;
    } else {
      s = diff / (2 - add);
    }

    this._hsla = [h, s, l, this._rgba[3]];
    return this._hsla;
  }

  hasAlpha(): boolean {
    return this._rgba[3] !== 1;
  }

  detectHEXFormat(): string {
    let canBeShort = true;
    for (let i = 0; i < 4; ++i) {
      const c = Math.round(this._rgba[i] * 255);
      if (c % 17) {
        canBeShort = false;
        break;
      }
    }

    const hasAlpha = this.hasAlpha();
    const cf = Color.Format;
    if (canBeShort) {
      return hasAlpha ? cf.ShortHEXA : cf.ShortHEX;
    }
    return hasAlpha ? cf.HEXA : cf.HEX;
  }

  asString(format: string): string | null {
    if (format === this._format && this._originalTextIsValid) {
      return this._originalText;
    }

    if (!format) {
      format = this._format;
    }

    function toRgbValue(value: number): number {
      return Math.round(value * 255);
    }

    function toHexValue(value: number): string {
      const hex = Math.round(value * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }

    function toShortHexValue(value: number): string {
      return (Math.round(value * 255) / 17).toString(16);
    }

    switch (format) {
      case Color.Format.Original:
        return this._originalText;
      case Color.Format.RGB:
        if (this.hasAlpha()) {
          return null;
        }
        return `rgb(${toRgbValue(this._rgba[0])}, ${
          toRgbValue(this._rgba[1])
        }, ${toRgbValue(this._rgba[2])})`;
      case Color.Format.RGBA:
        return `rgba(${toRgbValue(this._rgba[0])}, ${
          toRgbValue(this._rgba[1])
        }, ${toRgbValue(this._rgba[2])}, ${this._rgba[3]})`;
      case Color.Format.HSL: {
        if (this.hasAlpha()) {
          return null;
        }
        const hsl = this.hsla();
        return `hsl(${Math.round(hsl[0] * 360)}, ${
          Math.round(hsl[1] * 100)
        }%, ${Math.round(hsl[2] * 100)}%)`;
      }
      case Color.Format.HSLA: {
        const hsla = this.hsla();
        return `hsla(${Math.round(hsla[0] * 360)}, ${
          Math.round(hsla[1] * 100)
        }%, ${Math.round(hsla[2] * 100)}%, ${hsla[3]})`;
      }
      case Color.Format.HEXA:
        return `#${toHexValue(this._rgba[0])}${toHexValue(this._rgba[1])}${
          toHexValue(this._rgba[2])
        }${toHexValue(this._rgba[3])}`.toLowerCase();
      case Color.Format.HEX:
        if (this.hasAlpha()) {
          return null;
        }
        return `#${toHexValue(this._rgba[0])}${toHexValue(this._rgba[1])}${
          toHexValue(this._rgba[2])
        }`.toLowerCase();
      case Color.Format.ShortHEXA: {
        const hexFormat = this.detectHEXFormat();
        if (
          hexFormat !== Color.Format.ShortHEXA &&
          hexFormat !== Color.Format.ShortHEX
        ) {
          return null;
        }
        return `#${toShortHexValue(this._rgba[0])}${
          toShortHexValue(this._rgba[1])
        }${toShortHexValue(this._rgba[2])}${toShortHexValue(this._rgba[3])}`
          .toLowerCase();
      }
      case Color.Format.ShortHEX:
        if (this.hasAlpha()) {
          return null;
        }
        if (this.detectHEXFormat() !== Color.Format.ShortHEX) {
          return null;
        }
        return `#${toShortHexValue(this._rgba[0])}${
          toShortHexValue(this._rgba[1])
        }${toShortHexValue(this._rgba[2])}`.toLowerCase();
    }

    return this._originalText;
  }

  rgba(): Array<number> {
    return this._rgba.slice();
  }

  canonicalRGBA(): Array<number> {
    const rgba = new Array(4);
    for (let i = 0; i < 3; ++i) {
      rgba[i] = Math.round(this._rgba[i] * 255);
    }
    rgba[3] = this._rgba[3];
    return rgba;
  }

  static Regex =
    /((?:rgb|hsl)a?\([^)]+\)|#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3,4}|\b[a-zA-Z]+\b(?!-))/g;
  static Format = {
    Original: "original",
    HEX: "hex",
    ShortHEX: "shorthex",
    HEXA: "hexa",
    ShortHEXA: "shorthexa",
    RGB: "rgb",
    RGBA: "rgba",
    HSL: "hsl",
    HSLA: "hsla",
  };
}
