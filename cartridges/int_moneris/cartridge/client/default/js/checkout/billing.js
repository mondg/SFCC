'use strict';

const baseBilling = require('base/checkout/billing');
const monerisCheckout = require('./monerisCheckout');

baseBilling.handleCreditCardNumber = () => null;
baseBilling.methods.validateAndUpdateBillingPaymentInstrument = () => null;

baseBilling.methods.updatePaymentInformation = (order) => {
    const paymentSummary = document.querySelector('.payment-details');
    const paymentInstruments = order.billing.payment && order.billing.payment.selectedPaymentInstruments;
    const paymentInstrument = Array.isArray(paymentInstruments) ? paymentInstruments[0] : null;

    if (!paymentInstrument) {
        return;
    }

    const elementWrapper = document.createElement('div');

    elementWrapper.id = 'outerDiv';
    elementWrapper.classList.add('moneris-wrapper');

    const monerisElement = document.createElement('div');

    monerisElement.id = 'monerisCheckout';
    monerisElement.dataset.ticket = order.ticket;
    monerisElement.dataset.instance = order.instance;
    elementWrapper.appendChild(monerisElement);
    paymentSummary.innerHTML = '';
    paymentSummary.append(elementWrapper);

    monerisCheckout.monerisInit(monerisElement);
};

module.exports = baseBilling;
