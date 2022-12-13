'use strict';

const baseModel = module.superModule;

/**
 * @description Order class that represents the current order
 * @param {dw.order.LineItemCtnr} lineItemCtnr - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @param {Object} options.config - Object to help configure the orderModel
 * @param {string} options.config.numberOfLineItems - helps determine the number of lineitems needed
 * @param {string} options.countryCode - the current request country code
 * @constructor
 */
function OrderModel(lineItemCtnr, options) {
    baseModel.call(this, lineItemCtnr, options);

    if (lineItemCtnr && options.containerView === 'order') {
        const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');
        this.ticket = lineItemCtnr.custom.monerisTicket;
        this.instance = monerisHelper.getInstanceType();
        this.failReason = '';

        const paymentInstrument = lineItemCtnr.paymentInstruments[0] || {};
        if (paymentInstrument.paymentMethod === 'MONERIS_PAYMENT') {
            this.failReason = monerisHelper.getFailReason(lineItemCtnr);
        }
    }
}

module.exports = OrderModel;
