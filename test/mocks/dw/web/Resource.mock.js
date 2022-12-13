'use strict';

const path = require('path');
const properties = require('properties-parser');

class Resource {
    constructor(locale = 'x_default') {
        this.resourceDirPath = './cartridges/int_moneris/cartridge/templates/resources/';
        this.locale = locale;
    }

    msg(key, bundleName, defaultValue) {
        let bundlePath;
        let props;

        if (!key) {
            return defaultValue;
        }

        if (bundleName) {
            if (this.locale !== 'x_default') {
                bundlePath = path.resolve(`${this.resourceDirPath}${bundleName}_${this.locale}.properties`);
                try {
                    props = properties.read(bundlePath);
                    if (props[key]) {
                        return props[key];
                    }
                } catch (e) {
                    // continue
                }
            }

            bundlePath = path.resolve(`${this.resourceDirPath}${bundleName}.properties`);
            try {
                props = properties.read(bundlePath);
                if (props[key]) {
                    return props[key];
                }
            } catch (e) {
                // continue
            }
        }
        return defaultValue || key;
    }

    msgf() {
        if (arguments.length < 4) {
            return this.msg.apply(this, arguments);
        }

        const args = Array.prototype.slice.call(arguments);
        const value = this.msg.apply(this, args.slice(0, 3));

        return value.replace(/{(\d)}/g, function (match, p) {
            const position = Number(p);
            if (args[position + 3]) {
                return args[position + 3];
            }
            return match;
        });
    }
}

module.exports = Resource;
