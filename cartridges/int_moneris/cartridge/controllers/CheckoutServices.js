'use strict';

const server = require('server');

server.extend(module.superModule);

/**
 * CheckoutServices-SubmitPayment : The CheckoutServices-SubmitPayment endpoint creates an order with the previously
 * generated order number when Moneris payment method is chosen.
 * @name Moneris/CheckoutServices-SubmitPayment
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.append(
    'SubmitPayment',
    server.middleware.https,
    function (req, res, next) {
        const viewData = res.getViewData();

        if (viewData.error) {
            return next();
        }
        // Get the previously created handler for the event
        const oldHandler = this.listeners('route:BeforeComplete');

        this.off('route:BeforeComplete');
        // eslint-disable-next-line no-shadow
        this.on('route:BeforeComplete', function (req, res) {
            // Invoke the previously created handler for the BeforeComplete event before custom logic
            if (oldHandler[0]) {
                oldHandler[0].call(this, req, res);

                if (res.viewData.error) {
                    return;
                }
            }

            if (viewData.paymentMethod.value === 'MONERIS_PAYMENT' && session.privacy.orderNo) {
                const Locale = require('dw/util/Locale');
                const BasketMgr = require('dw/order/BasketMgr');
                const Transaction = require('dw/system/Transaction');
                const Resource = require('dw/web/Resource');
                const OrderModel = require('*/cartridge/models/order');
                const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
                const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

                const currentBasket = BasketMgr.getCurrentBasket();

                const validationOrderStatus = hooksHelper(
                    'app.validate.order',
                    'validateOrder',
                    currentBasket,
                    require('*/cartridge/scripts/hooks/validateOrder').validateOrder
                );
                if (validationOrderStatus.error) {
                    res.json({
                        error: true,
                        errorMessage: validationOrderStatus.message
                    });
                    delete session.privacy.orderNo;
                    return;
                }

                const validPayment = COHelpers.validatePayment(req, currentBasket);
                if (validPayment.error) {
                    res.json({
                        error: true,
                        errorStage: {
                            stage: 'payment',
                            step: 'paymentInstrument'
                        },
                        errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
                    });
                    delete session.privacy.orderNo;
                    return;
                }

                const calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
                if (calculatedPaymentTransactionTotal.error) {
                    res.json({
                        error: true,
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });
                    delete session.privacy.orderNo;
                    return;
                }

                const order = COHelpers.createOrder(currentBasket, session.privacy.orderNo);
                if (order) {
                    Transaction.wrap(() => {
                        order.custom.paymentMethod = 'MONERIS_PAYMENT';
                        order.custom.monerisTicket = session.privacy.ticket;
                        delete session.privacy.ticket;
                    });

                    const currentLocale = Locale.getLocale(req.locale.id);

                    viewData.order = new OrderModel(
                        order,
                        { countryCode: currentLocale.country, containerView: 'order' }
                    );
                    viewData.error = false;

                    res.json(viewData);
                } else {
                    res.json({
                        error: true,
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });

                    delete session.privacy.orderNo;
                }
            }
        });

        return next();
    }
);

/**
 * CheckoutServices-PlaceOrder : The CheckoutServices-PlaceOrder endpoint places the order
 * @name Moneris/CheckoutServices-PlaceOrder
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.replace('PlaceOrder', server.middleware.https, function (req, res, next) {
    const BasketMgr = require('dw/order/BasketMgr');
    const Order = require('dw/order/Order');
    const OrderMgr = require('dw/order/OrderMgr');
    const Resource = require('dw/web/Resource');
    const Transaction = require('dw/system/Transaction');
    const URLUtils = require('dw/web/URLUtils');
    const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    const validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    const addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
    const monerisConstants = require('*/cartridge/scripts/helpers/monerisHelper').constants;

    let order = session.privacy.orderNo ?
        OrderMgr.getOrder(session.privacy.orderNo, session.privacy.orderToken) :
        null;

    const currentBasket = BasketMgr.getCurrentBasket();
    if (empty(order)) {
        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        const validatedProducts = validationHelpers.validateProducts(currentBasket);
        if (validatedProducts.error) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        if (req.session.privacyCache.get('fraudDetectionStatus')) {
            res.json({
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });

            return next();
        }

        const validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
        if (validationOrderStatus.error) {
            res.json({
                error: true,
                errorMessage: validationOrderStatus.message
            });
            return next();
        }

        // Check to make sure there is a shipping address
        if (currentBasket.defaultShipment.shippingAddress === null) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'shipping',
                    step: 'address'
                },
                errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
            });
            return next();
        }

        // Check to make sure billing address exists
        if (!currentBasket.billingAddress) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'billingAddress'
                },
                errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
            });
            return next();
        }

        // Calculate the basket
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        // Re-validates existing payment instruments
        const validPayment = COHelpers.validatePayment(req, currentBasket);
        if (validPayment.error) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'paymentInstrument'
                },
                errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
            });
            return next();
        }

        // Re-calculate the payments.
        const calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
        if (calculatedPaymentTransactionTotal.error) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }

        // Creates a new order.
        order = COHelpers.createOrder(currentBasket);
    }

    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    // Handles payment authorization
    const handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);

    // Handle custom processing post authorization
    const options = {
        req: req,
        res: res
    };
    const postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', handlePaymentResult, order, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
    if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
        res.json(postAuthCustomizations);
        return next();
    }

    if (handlePaymentResult.error) {
        let jsonResponse;

        if (handlePaymentResult.isAuthorizationError) {
            jsonResponse = {
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Checkout-Begin').toString()
            };
        } else {
            jsonResponse = {
                error: true,
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            };
        }

        res.json(jsonResponse);
        return next();
    }

    const fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);

        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });

        return next();
    }

    // Places the order
    const placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);

    if (order.custom.monerisTransactionCode === monerisConstants.PRE_AUTH_TRANSACTION_CODE) {
        Transaction.wrap(() => order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED));
    }

    if (placeOrderResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    if (req.currentCustomer.addressBook) {
        // save all used shipping addresses to address book of the logged in customer
        const allAddresses = addressHelpers.gatherShippingAddresses(order);
        allAddresses.forEach(function (address) {
            if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
            }
        });
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, req.locale.id);
    }

    // Reset usingMultiShip after successful Order placement
    req.session.privacyCache.set('usingMultiShipping', false);

    res.json({
        error: false,
        orderID: order.orderNo,
        orderToken: order.orderToken,
        continueUrl: URLUtils.url('Order-Confirm').toString()
    });

    return next();
});

/**
 * CheckoutServices-PlaceOrder : The CheckoutServices-CancelOrder endpoint cancels the order
 * In case user clicks on 'cancel' in Moneris Checkout
 * @name Moneris/CheckoutServices-CancelOrder
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post('CancelOrder', server.middleware.https, function (req, res, next) {
    const OrderMgr = require('dw/order/OrderMgr');
    const URLUtils = require('dw/web/URLUtils');
    const Transaction = require('dw/system/Transaction');

    let order = session.privacy.orderNo ?
        OrderMgr.getOrder(session.privacy.orderNo, session.privacy.orderToken) :
        null;

    if (!empty(order)) {
        Transaction.wrap(() => OrderMgr.failOrder(order, true));
    }

    Transaction.wrap(() => {
        order.custom.cancelledOrder = true;
    });

    if (res.viewData.queryString === 'handler=page_closed') {
        return next();
    }

    res.json({
        error: true,
        cartError: true,
        fieldErrors: [],
        serverErrors: [],
        redirectUrl: URLUtils.url('Cart-Show').toString()
    });

    return next();
});

module.exports = server.exports();
