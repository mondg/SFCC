'use strict';

const base = module.superModule;

/**
 * @description Creates an order from the current basket
 * @param {dw.order.Basket} currentBasket - API Basket instance
 * @param {string} orderNo - Previously generated order number
 * @returns {dw.order.Order|null} - API Order instance created from the current basket or null in case of error
 */
function createOrder(currentBasket, orderNo) {
    const Transaction = require('dw/system/Transaction');
    const OrderMgr = require('dw/order/OrderMgr');

    let order = null;

    try {
        if (orderNo) {
            order = Transaction.wrap(() => OrderMgr.createOrder(currentBasket, orderNo));
        } else {
            order = Transaction.wrap(() => OrderMgr.createOrder(currentBasket));
        }
    } catch (error) {
        return order;
    }

    session.privacy.orderToken = order.orderToken;

    return order;
}

/**
 * @description Handles payments and returns a token object
 * @param {dw.order.Order} order - API Order instance
 * @param {string} orderNumber - Order number
 * @returns {Object} - Token object to be processed in postAuthorizationHandling
 */
function handlePayments(order, orderNumber) {
    const Transaction = require('dw/system/Transaction');
    const OrderMgr = require('dw/order/OrderMgr');
    const PaymentMgr = require('dw/order/PaymentMgr');
    const HookMgr = require('dw/system/HookMgr');

    const result = {};

    if (order.totalNetPrice !== 0.00) {
        const paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(() => OrderMgr.failOrder(order, true));
            result.error = true;
        }

        if (result.error) {
            return result;
        }

        for (let i = 0; i < paymentInstruments.length; i++) {
            const paymentInstrument = paymentInstruments[i];
            const paymentProcessor = PaymentMgr
                .getPaymentMethod(paymentInstrument.paymentMethod)
                .paymentProcessor;
            let authorizationResult;

            if (paymentProcessor === null) {
                Transaction.wrap(() => paymentInstrument.paymentTransaction.setTransactionID(orderNumber));
            } else {
                if (HookMgr.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase())) {
                    authorizationResult = HookMgr.callHook(
                        'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                        'Authorize',
                        orderNumber,
                        paymentInstrument,
                        paymentProcessor
                    );
                } else {
                    authorizationResult = HookMgr.callHook(
                        'app.payment.processor.default',
                        'Authorize'
                    );
                }

                if (paymentInstrument.paymentMethod === 'MONERIS_PAYMENT') {
                    result.token = authorizationResult.token;
                    result.vaultData = authorizationResult.vaultData;

                    if (authorizationResult.error) {
                        if (!authorizationResult.skipOrder) {
                            Transaction.wrap(() => OrderMgr.failOrder(order, true));
                        }

                        result.error = true;
                        result.errorMessage = authorizationResult.errorMessage || 'Authorization Error';
                        result.isAuthorizationError = true;
                    }
                    break;
                }
            }
        }
    }
    return result;
}

base.createOrder = createOrder;
base.handlePayments = handlePayments;

module.exports = base;
