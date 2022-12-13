'use strict';

class Wallet {
    constructor(paymentInstruments = []) {
        this.paymentInstruments = paymentInstruments;
    }

    getPaymentInstruments() {
        return { toArray: () => this.paymentInstruments };
    }

    removePaymentInstrument() {
        return undefined;
    }

    createPaymentInstrument() {
        const paymentInstrument = { custom: {}, creationDate: 100 };
        this.paymentInstruments.push(paymentInstrument);
        return paymentInstrument;
    }
}

module.exports = Wallet;
