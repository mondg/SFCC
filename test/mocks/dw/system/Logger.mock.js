'use strict';

class Logger {
    static getRootLogger() {
        return this;
    }

    static getLogger() {
        return this;
    }

    static warn() {
        return {};
    }

    static error() {
        return {};
    }

    static debug() {
        return {};
    }

    error() {
        return {};
    }

    debug() {
        return {};
    }

    fatal() {
        return {};
    }
}

module.exports = Logger;
