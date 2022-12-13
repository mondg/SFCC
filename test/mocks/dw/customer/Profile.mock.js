'use strict';

const Wallet = require('./Wallet.mock');

class Profile {
    constructor() {
        this.wallet = new Wallet();
    }
}

module.exports = Profile;
