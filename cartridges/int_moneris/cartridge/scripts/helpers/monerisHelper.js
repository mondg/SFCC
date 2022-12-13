'use strict';

const constants = {
    ACCEPTED_KEY: 'a',
    SUCCESS_TRESHOLD: 50,
    PRE_AUTH_TRANSACTION_CODE: '01',
    PURCHASE_TRANSACTION_CODE: '00',
    APPROVAL_CODE: 29,
    ZERO_AMOUNT: '0.00',
    REFUND_NOT_SEND: 0,
    REFUND_SUCCESSED: 1,
    REFUND_DECLINED: 2
};

/**
 * @description Returns saved Moneris payment tokens from the customer wallet
 * @returns {Array<Object>} - An array of saved Moneris payment tokens
 */
function getPaymentTokens() {
    const paymentInstruments = customer.profile.wallet.getPaymentInstruments('MONERIS_PAYMENT');
    return paymentInstruments.toArray().map(instrument =>
        ({
            data_key: instrument.custom.monerisDataKey,
            issuer_id: instrument.custom.monerisIssuerId
        })
    );
}

/**
 * @description Saves the specified Moneris payment token to the customer wallet
 * @param {Object} token - Moneris token data to be saved
 * @param {dw.order.Order} order - API Order instance
 * @return {boolean} - Flag indicating if the specified token is saved
 */
function savePaymentToken(token, order) {
    const Transaction = require('dw/system/Transaction');
    const CustomerMgr = require('dw/customer/CustomerMgr');
    let isTokenSaved = false;

    if (!(order.customer && order.customer.registered && token && token.data_key)) {
        return isTokenSaved;
    }

    let currentCustomer = customer;
    if (!currentCustomer && order.customerNo) {
        currentCustomer = CustomerMgr.getCustomerByCustomerNumber(order.customerNo);
    }

    const MAX_TOKENS = 3;
    const wallet = currentCustomer.profile.wallet;

    Transaction.wrap(() => {
        let newPaymentInstrument = wallet.createPaymentInstrument('MONERIS_PAYMENT');

        newPaymentInstrument.custom.monerisDataKey = token.data_key;
        newPaymentInstrument.custom.monerisIssuerId = token.issuer_id;
        newPaymentInstrument.creditCardType = token.creditCardType;
        newPaymentInstrument.creditCardHolder = token.cardHolder;
        newPaymentInstrument.creditCardNumber = token.cardNumber;
        isTokenSaved = true;
    });

    const paymentInstruments = wallet.getPaymentInstruments('MONERIS_PAYMENT').toArray();

    if (MAX_TOKENS < paymentInstruments.length) {
        Transaction.wrap(() => {
            paymentInstruments
                .sort((prev, next) => next.creationDate - prev.creationDate)
                .slice(MAX_TOKENS - paymentInstruments.length)
                .forEach(instrument => wallet.removePaymentInstrument(instrument));
        });
    }
    return isTokenSaved;
}

/**
 * @description Removes saved invalid Moneris payment tokens
 * @param {Object} vaultData - Moneris vault data
 * @param {dw.order.Order} order - API Order instance
 * @returns {boolean} - Flag indicating if at least one invalid token is removed
 */
function removeInvalidPaymentTokens(vaultData, order) {
    const Transaction = require('dw/system/Transaction');
    const CustomerMgr = require('dw/customer/CustomerMgr');
    let isInvalidTokenRemoved = false;

    if (!(order.customer && order.customer.registered && vaultData)) {
        return isInvalidTokenRemoved;
    }

    let currentCustomer = customer;
    if (!currentCustomer && order.customerNo) {
        currentCustomer = CustomerMgr.getCustomerByCustomerNumber(order.customerNo);
    }

    const wallet = currentCustomer.profile.wallet;
    const paymentInstruments = wallet.getPaymentInstruments('MONERIS_PAYMENT');

    paymentInstruments.toArray().forEach(instrument => {
        const vault = vaultData.find(element => element.data_key === instrument.custom.monerisDataKey);

        if (!vault || !vault.is_valid) {
            Transaction.wrap(() => {
                wallet.removePaymentInstrument(instrument);
            });
            isInvalidTokenRemoved = true;
        }
    });
    return isInvalidTokenRemoved;
}

/**
 * @description Returns the type of the instance
 * @returns {string} - 'prod' for the production instance, 'qa' for the rest instances
 */
function getInstanceType() {
    const System = require('dw/system/System');
    return System.getInstanceType() === System.PRODUCTION_SYSTEM ? 'prod' : 'qa';
}

/**
 * @description Returns Moneris ticket
 * @returns {string|null} - Moneris ticket or null if customer basket is empty
 */
function getTicket() {
    const BasketMgr = require('dw/order/BasketMgr');
    const OrderMgr = require('dw/order/OrderMgr');
    const Site = require('dw/system/Site');
    const monerisService = require('*/cartridge/scripts/services/monerisService');
    const basket = BasketMgr.getCurrentBasket();
    const customPreferences = Site.current.preferences.custom;

    let ticket = null;
    if (empty(basket)) {
        return ticket;
    }

    const orderNo = OrderMgr.createOrderNo();
    const requestData = {
        lineItemCtnr: basket,
        orderNo: orderNo,
        instanceType: getInstanceType(),
        store_id: customPreferences.monerisStoreId,
        api_token: customPreferences.monerisApiToken,
        checkout_id: customPreferences.monerisCheckoutId,
        ask_cvv: customPreferences.monerisAskCVV,
        dynamic_descriptor: customPreferences.monerisDynamicDescriptor,
        language: customPreferences.monerisLng.value
    };

    if (customer.authenticated) {
        requestData.token = getPaymentTokens();
    }

    const serviceResult = monerisService.preloadCall(requestData);
    const response = serviceResult.object ? serviceResult.object.response : null;

    if (response && response.error && response.error.order_no === 'Duplicate orderId') {
        const Logger = require('dw/system/Logger').getLogger('Moneris');
        Logger.error('{0} in order with id: {1}', response.error.order_no, orderNo);
    }

    if (serviceResult.ok && response && response.success) {
        ticket = response.ticket;
        session.privacy.orderNo = orderNo;
        session.privacy.ticketId = ticket;
    }

    return ticket;
}

/**
 * @description Returns Moneris receipt
 * @param {string} ticket - Moneris ticket
 * @returns {Object} - Moneris receipt object
 */
function getReceipt(ticket) {
    const Site = require('dw/system/Site');
    const monerisService = require('*/cartridge/scripts/services/monerisService');
    const customPreferences = Site.current.preferences.custom;

    return monerisService.receiptCall({
        instanceType: getInstanceType(),
        store_id: customPreferences.monerisStoreId,
        api_token: customPreferences.monerisApiToken,
        checkout_id: customPreferences.monerisCheckoutId,
        dynamic_descriptor: customPreferences.monerisDynamicDescriptor,
        ticket: ticket
    });
}

/**
 * @description Validates if all the specified gift cards are valid
 * @param {Array} giftCards - Array of gift cards
 * @returns {boolean} - Flag indicating if all the specified gift cards are valid
 */
function areAllGiftCardsValid(giftCards) {
    return giftCards.every(card => card.response_code && Number(card.response_code) < constants.SUCCESS_TRESHOLD);
}

/**
 * @description Validates the specified credit card
 * @param {Object} creditCardInfo - Credit card information
 * @returns {boolean} - Flag indicating if the specified credit card is valid
 */
function isCreditCardValid(creditCardInfo) {
    return creditCardInfo.result === constants.ACCEPTED_KEY && creditCardInfo.response_code < constants.SUCCESS_TRESHOLD;
}

/**
 * @description Returns a string representation of the transaction failure reason or an empty string if there is no failure
 * @param {dw.order.Order} order - API Order instance
 * @returns {string} - String representation of the failure reason or an empty string if there is no failure
 */
function getFailReason(order) {
    const Resource = require('dw/web/Resource');
    const RESOURCES = {
        cancelledTransaction: Resource.msg('label.orderhistory.cancelled.transaction', 'account', null),
        declinedTransaction: Resource.msg('label.orderhistory.declined.transaction', 'account', null),
        timeout: Resource.msg('label.orderhistory.timeout', 'account', null)
    };
    const TIMEOUT = {
        RB_CODE: '113',
        ISO_CODE_1: '68',
        ISO_CODE_2: '96'
    };
    const ORDER_STATUS_FAILED = require('dw/order/Order').ORDER_STATUS_FAILED;

    const responseCode = 'monerisResponseCode' in order.custom ? order.custom.monerisResponseCode : null;
    const ISOResponseCode = 'monerisISOResponseCode' in order.custom ? order.custom.monerisISOResponseCode : null;
    const cancelledOrder = 'cancelledOrder' in order.custom ? order.custom.cancelledOrder : null;
    let failReason = '';

    if (cancelledOrder) {
        failReason = RESOURCES.cancelledTransaction;
    } else if ((responseCode === TIMEOUT.RB_CODE &&
            (ISOResponseCode === TIMEOUT.ISO_CODE_1 || ISOResponseCode === TIMEOUT.ISO_CODE_2)) ||
        (empty(responseCode) && empty(ISOResponseCode) && order.status === ORDER_STATUS_FAILED)) {
        failReason = RESOURCES.timeout;
    } else if (responseCode >= constants.SUCCESS_TRESHOLD) {
        failReason = RESOURCES.declinedTransaction;
    }

    return failReason;
}

module.exports = {
    constants: constants,
    getTicket: getTicket,
    getReceipt: getReceipt,
    getInstanceType: getInstanceType,
    areAllGiftCardsValid: areAllGiftCardsValid,
    isCreditCardValid: isCreditCardValid,
    savePaymentToken: savePaymentToken,
    removeInvalidPaymentTokens: removeInvalidPaymentTokens,
    getFailReason: getFailReason
};
