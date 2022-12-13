'use strict';

/**
 * @description Handles the post payment authorization customizations
 * @param {Object} handlePaymentResult - Payment handling result
 * @param {dw.order.Order} order - API Order instance
 */
function postAuthorization(handlePaymentResult, order) {
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');

    monerisHelper.removeInvalidPaymentTokens(handlePaymentResult.vaultData, order);
    monerisHelper.savePaymentToken(handlePaymentResult.token, order);
}

exports.postAuthorization = postAuthorization;
