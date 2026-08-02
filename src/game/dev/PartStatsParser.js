const MAX_SOURCE_LENGTH = 20_000;
const MAX_DEPTH = 8;
const MAX_COLLECTION_LENGTH = 256;
const MAX_STRING_LENGTH = 500;
const BLOCKED_KEYS = new Set([
    '__proto__',
    'constructor',
    'prototype'
]);

export function parsePartStatsLiteral(source) {
    if (
        typeof source !== 'string' ||
        source.length === 0 ||
        source.length > MAX_SOURCE_LENGTH
    ) {
        return null;
    }

    try {
        const parser = new LiteralParser(source);
        const value = parser.parseValue(0);
        parser.skipWhitespace();
        return parser.position === source.length &&
            isRecord(value)
            ? value
            : null;
    } catch {
        return null;
    }
}

class LiteralParser {
    constructor(source) {
        this.source = source;
        this.position = 0;
    }

    parseValue(depth) {
        if (depth > MAX_DEPTH) throw new Error('literal is too deep');
        this.skipWhitespace();
        const token = this.source[this.position];
        if (token === '{') return this.parseObject(depth + 1);
        if (token === '[') return this.parseArray(depth + 1);
        if (token === '"' || token === "'") return this.parseString();
        if (token === '-' || isDigit(token)) return this.parseNumber();
        return this.parseKeyword();
    }

    parseObject(depth) {
        const value = {};
        let count = 0;
        this.expect('{');
        this.skipWhitespace();
        if (this.consume('}')) return value;

        while (true) {
            if (++count > MAX_COLLECTION_LENGTH) {
                throw new Error('object has too many keys');
            }
            const key = this.parseKey();
            if (BLOCKED_KEYS.has(key)) throw new Error('blocked object key');
            this.skipWhitespace();
            this.expect(':');
            value[key] = this.parseValue(depth);
            this.skipWhitespace();
            if (this.consume('}')) return value;
            this.expect(',');
            this.skipWhitespace();
            if (this.consume('}')) return value;
        }
    }

    parseArray(depth) {
        const value = [];
        this.expect('[');
        this.skipWhitespace();
        if (this.consume(']')) return value;

        while (true) {
            if (value.length >= MAX_COLLECTION_LENGTH) {
                throw new Error('array has too many items');
            }
            value.push(this.parseValue(depth));
            this.skipWhitespace();
            if (this.consume(']')) return value;
            this.expect(',');
            this.skipWhitespace();
            if (this.consume(']')) return value;
        }
    }

    parseKey() {
        this.skipWhitespace();
        const token = this.source[this.position];
        if (token === '"' || token === "'") return this.parseString();
        const match = this.source
            .slice(this.position)
            .match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
        if (!match) throw new Error('invalid object key');
        this.position += match[0].length;
        return match[0];
    }

    parseString() {
        const quote = this.source[this.position++];
        let value = '';
        while (this.position < this.source.length) {
            const token = this.source[this.position++];
            if (token === quote) return value;
            if (token === '\\') {
                value += this.parseEscape();
            } else {
                value += token;
            }
            if (value.length > MAX_STRING_LENGTH) {
                throw new Error('string is too long');
            }
        }
        throw new Error('unterminated string');
    }

    parseEscape() {
        const token = this.source[this.position++];
        const simple = {
            '"': '"',
            "'": "'",
            '\\': '\\',
            '/': '/',
            b: '\b',
            f: '\f',
            n: '\n',
            r: '\r',
            t: '\t'
        };
        if (Object.hasOwn(simple, token)) return simple[token];
        if (token !== 'u') throw new Error('invalid string escape');
        const hex = this.source.slice(this.position, this.position + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new Error('invalid unicode escape');
        }
        this.position += 4;
        return String.fromCharCode(Number.parseInt(hex, 16));
    }

    parseNumber() {
        const match = this.source
            .slice(this.position)
            .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
        if (!match) throw new Error('invalid number');
        this.position += match[0].length;
        const value = Number(match[0]);
        if (!Number.isFinite(value)) throw new Error('non-finite number');
        return value;
    }

    parseKeyword() {
        for (const [keyword, value] of [
            ['true', true],
            ['false', false],
            ['null', null]
        ]) {
            if (this.source.startsWith(keyword, this.position)) {
                this.position += keyword.length;
                return value;
            }
        }
        throw new Error('unsupported literal');
    }

    skipWhitespace() {
        while (/\s/.test(this.source[this.position] || '')) {
            this.position++;
        }
    }

    expect(token) {
        if (!this.consume(token)) {
            throw new Error(`expected ${token}`);
        }
    }

    consume(token) {
        if (this.source[this.position] !== token) return false;
        this.position++;
        return true;
    }
}

function isRecord(value) {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}

function isDigit(value) {
    return typeof value === 'string' && /^[0-9]$/.test(value);
}
