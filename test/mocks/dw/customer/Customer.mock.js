'use strict';

const Profile = require('./Profile.mock');

class Customer {
    constructor() {
        this.profile = new Profile();
    }
}

module.exports = Customer;
