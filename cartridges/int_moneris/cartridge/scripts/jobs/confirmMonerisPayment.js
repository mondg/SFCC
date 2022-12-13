/* eslint-disable no-loop-func,no-continue */
'use strict';

const OrderMgr = require('dw/order/OrderMgr');
const Transaction = require('dw/system/Transaction');
const Order = require('dw/order/Order');
const Status = require('dw/system/Status');
const Logger = require('dw/system/Logger').getLogger('Moneris');

/**
 * Minutes get converted into seconds and subtracted from current time; query picks up orders
 * @param {Array} params - array whcih contains job step params
 * timeFrame - how much time in minutes needs to pass after order creation for a particular order to be
 * picked up by this job
 * @returns {dw.system.Status} Status Code
 */
function paymentConfirmation(params) {
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');
    const timeFrameInMS = params.timeFrame * 60 * 1000;
    const validTimeFrame = new Date(Date.now() - timeFrameInMS);
    const orderQuery = 'status={0} AND creationDate < {1}  AND  custom.paymentMethod={2}';
    const ordersToConfirm = OrderMgr.searchOrders(orderQuery,
        null,
        Order.ORDER_STATUS_CREATED,
        validTimeFrame,
        'MONERIS_PAYMENT');
    let handlePaymentResult = null;
    let order;
    let monerisTicket;

    if (!ordersToConfirm.count) {
        return new Status(Status.OK, null, 'No Orders found');
    }

    try {
        while (ordersToConfirm.hasNext()) {
            order = ordersToConfirm.next();
            monerisTicket = order.custom.monerisTicket;
            if (empty(monerisTicket)) {
                continue;
            }

            session.privacy.orderToken = order.orderToken;
            handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
            if (handlePaymentResult.errorMessage === 'Service Error') {
                Logger.error(handlePaymentResult.errorMessage);
                throw new Error(handlePaymentResult.errorMessage);
            }

            if (handlePaymentResult.error) {
                if (handlePaymentResult.errorMessage === 'Incomplete order') {
                    Logger.error('Confirmation request error for order {0}: {1}',
                        order.orderNo,
                        handlePaymentResult.errorMessage);
                } else if (handlePaymentResult.error) {
                    Logger.error(handlePaymentResult.errorMessage);
                }
                continue;
            }

            try {
                monerisHelper.removeInvalidPaymentTokens(handlePaymentResult.vaultData, order);
                monerisHelper.savePaymentToken(handlePaymentResult.token, order);

                Transaction.wrap(() => {
                    const placeOrderStatus = OrderMgr.placeOrder(order);
                    if (placeOrderStatus.error) {
                        throw new Error();
                    }

                    if (order.custom.monerisTransactionCode === monerisHelper.constants.PURCHASE_TRANSACTION_CODE) {
                        order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                    }
                    order.setExportStatus(Order.EXPORT_STATUS_READY);
                });
            } catch (e) {
                Transaction.wrap(() => {
                    OrderMgr.failOrder(order, true);
                });
                Logger.error('Order failed');
            }
        }

        return new Status(Status.OK);
    } catch (error) {
        return new Status(Status.ERROR, 'Confirm Moneris Payment', JSON.stringify(error));
    }
}

module.exports = {
    paymentConfirmation: paymentConfirmation
};
