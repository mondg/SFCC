'use strict';

const Site = require('dw/system/Site');
const Transaction = require('dw/system/Transaction');
const Order = require('dw/order/Order');
const OrderMgr = require('dw/order/OrderMgr');
const Status = require('dw/system/Status');
const Logger = require('dw/system/Logger').getLogger('Moneris');

/**
 * @description Makes a zero amount Completion service call for the given order and request data.
 * Adds APPROVED or DECLINED status-message in order's Notes.
 * @param {dw.order.Order} order - Order to process.
 * @param {Object} requestData - request data.
 */
function zeroAmountCompletionCall(order, requestData) {
    const monerisService = require('*/cartridge/scripts/services/monerisService');
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');

    requestData.amount = monerisHelper.constants.ZERO_AMOUNT;
    const serviceResult = monerisService.completionCall(requestData);

    if (serviceResult.error) {
        if (serviceResult.unavailableReason) {
            Logger.error('Service error: {0}', serviceResult.unavailableReason);
            throw new Error(serviceResult.unavailableReason);
        } else {
            Logger.error('Zero amount Completion request error: {0}', serviceResult.errorMessage);
        }
    }

    const response = serviceResult.response;

    Transaction.wrap(() => {
        if (response.ResponseCode &&
            Number(response.ResponseCode) <= monerisHelper.constants.APPROVAL_CODE) {
            order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            order.paymentTransaction.transactionID = response.TxnNumber;
            order.custom.monerisTransactionNo = response.TxnNumber;
            order.addNote('Zero amount Completion request is APPROVED.', response.Message);
            order.custom.monerisRefundStatus = monerisHelper.constants.REFUND_SUCCESSED;
        } else {
            order.addNote('Zero amount Completion request is DECLINED. Reason: ', response.Message);
            order.setStatus(Order.ORDER_STATUS_CANCELLED);
            Logger.error('Order {0} zero amount capture is failed', requestData.order_id);
        }
    });
}

/**
 * @description Makes a refund service call for the given order and request data.
 * Adds APPROVED or DECLINED status-message in order's Notes.
 * @param {dw.order.Order} order - Order to process.
 * @param {Object} requestData - request data.
 */
function refundCall(order, requestData) {
    const monerisService = require('*/cartridge/scripts/services/monerisService');
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');

    let serviceResult = monerisService.refundCall(requestData);

    if (serviceResult.error) {
        if (serviceResult.unavailableReason) {
            Logger.error('Service error: {0}', serviceResult.unavailableReason);
            throw new Error(serviceResult.unavailableReason);
        } else {
            Logger.error('Refund request error: {0}', serviceResult.errorMessage);
        }
    }

    let response = serviceResult.response;

    Transaction.wrap(() => {
        if (response.ResponseCode &&
            Number(response.ResponseCode) <= monerisHelper.constants.APPROVAL_CODE) {
            order.addNote('Refund request is APPROVED. Refund info: ', JSON.stringify(response));
            order.custom.monerisRefundStatus = monerisHelper.constants.REFUND_SUCCESSED;
        } else {
            order.addNote('Refund request is DECLINED. Reason: ', response.Message);
            order.custom.monerisRefundStatus = monerisHelper.constants.REFUND_DECLINED;
            Logger.error('Order {0} refund is failed', requestData.order_id);
        }
    });
}

/**
 * @description Makes a void service call for the given order and request data.
 * Adds APPROVED or DECLINED status-message in order's Notes.
 * @param {dw.order.Order} order - Order to process.
 * @param {Object} requestData - request data.
 */
function voidCall(order, requestData) {
    const monerisService = require('*/cartridge/scripts/services/monerisService');
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');

    const serviceResult = monerisService.voidCall(requestData);

    if (serviceResult.error) {
        if (serviceResult.unavailableReason) {
            Logger.error('Service error: {0}', serviceResult.unavailableReason);
            throw new Error(serviceResult.unavailableReason);
        } else {
            Logger.error('Void request error: {0}', serviceResult.errorMessage);
        }
    }

    const response = serviceResult.response;

    Transaction.wrap(() => {
        if (response.ResponseCode &&
            Number(response.ResponseCode) <= monerisHelper.constants.APPROVAL_CODE) {
            order.addNote('Void request is APPROVED. Void info: ', JSON.stringify(response));
            order.custom.monerisRefundStatus = monerisHelper.constants.REFUND_SUCCESSED;
        } else {
            order.addNote('Void request is DECLINED. Reason: ', response.Message);
            refundCall(order, requestData);
        }
    });
}

/**
 * @description Refund job process function.
 * Function makes a void or refund call for order selected by qeury. Adds APPROVED or DECLINED status-message in order's Notes.
 *  @returns {dw.system.Status} Status Code
 */
function ordersRefund() {
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');
    const customPreferences = Site.current.preferences.custom;
    const ORDER_QUERY = 'status = {0} AND custom.monerisRefundStatus = {1} AND custom.monerisTransactionNo != NULL';

    const refundOrders = OrderMgr.searchOrders(
        ORDER_QUERY,
        null,
        Order.ORDER_STATUS_CANCELLED,
        monerisHelper.constants.REFUND_NOT_SEND
    );

    if (!refundOrders.count) {
        return new Status(Status.OK, null, 'No Orders found');
    }

    try {
        let order = null;
        let orderId = '';
        let amount = '';
        let requestData = {};

        while (refundOrders.hasNext()) {
            order = refundOrders.next();
            orderId = order.orderNo;
            amount = String(order.paymentTransaction.amount.value);
            requestData = {
                store_id: customPreferences.monerisStoreId,
                api_token: customPreferences.monerisApiToken,
                txn_number: order.paymentTransaction.transactionID,
                order_id: orderId,
                amount: amount
            };

            // The following implemented for testing purposes
            if (monerisHelper.getInstanceType() === 'qa') {
                requestData.txn_number = order.custom.monerisTransactionNo;
            }

            if (order.custom.monerisTransactionCode === monerisHelper.constants.PRE_AUTH_TRANSACTION_CODE &&
                order.paymentStatus.value === Order.PAYMENT_STATUS_NOTPAID) {
                zeroAmountCompletionCall(order, requestData);
            } else {
                voidCall(order, requestData);
            }
        }

        return new Status(Status.OK);
    } catch (error) {
        return new Status(Status.ERROR, 'Moneris Refund', error);
    }
}

module.exports = {
    ordersRefund: ordersRefund
};
