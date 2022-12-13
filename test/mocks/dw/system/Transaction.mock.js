'use strict';

class Transaction {
    static wrap(callback) {
        return callback.call(null);
    }
}

module.exports = Transaction;
