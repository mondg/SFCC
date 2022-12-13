/* eslint-disable no-undef */
'use strict';

/**
 * @description Initializes MonerisCheckout
 * @param {HTMLElement} element - MonerisCheckout container
 */
function initialize(element) {
    const REDIRECT_DELAY = 4000;
    const placeOrderElement = document.querySelector('.place-order');
    placeOrderElement.style.display = 'none';

    // eslint-disable-next-line new-cap
    const monerisCheckoutInstance = new monerisCheckout();
    monerisCheckoutInstance.setMode(element.dataset.instance);
    monerisCheckoutInstance.setCheckoutDiv(element.id);

    const submitAction = (action, data) => {
        monerisCheckoutInstance.closeCheckout();

        if (action === 'cancel') {
            const cancelRoute = data
                ? `CheckoutServices-CancelOrder/?handler=${JSON.parse(data).handler}`
                : 'CheckoutServices-CancelOrder';
            placeOrderElement.setAttribute('data-action', cancelRoute);
        }
        placeOrderElement.click();
    };

    monerisCheckoutInstance.setCallback('page_loaded', () => {
        document.querySelector('.payment-summary').scrollIntoView({
            behavior: 'smooth'
        });
        document.querySelectorAll('.edit-button.pull-right').forEach(el => {
            el.style.display = 'none';
        });
    });

    monerisCheckoutInstance.setCallback('cancel_transaction', () => {
        submitAction('cancel');
    });

    monerisCheckoutInstance.setCallback('error_event', () => {
        setTimeout(submitAction, REDIRECT_DELAY);
    });

    monerisCheckoutInstance.setCallback('payment_receipt', () => {
        monerisCheckoutInstance.setCallback('page_closed', null);
        setTimeout(submitAction, REDIRECT_DELAY);
    });

    monerisCheckoutInstance.setCallback('payment_complete', () => {
        monerisCheckoutInstance.setCallback('page_closed', null);
        setTimeout(submitAction, REDIRECT_DELAY);
    });

    monerisCheckoutInstance.setCallback('page_closed', data => {
        submitAction('cancel', data);
    });

    monerisCheckoutInstance.startCheckout(element.dataset.ticket);
}

/**
 * @description Initializes MonerisCheckout
 * @param {HTMLElement} element - MonerisCheckout container
 */
function monerisInit(element) {
    if (typeof monerisCheckout === 'undefined' || !monerisCheckout) {
        document.addEventListener('DOMContentLoaded', () => initialize(element));
    } else {
        initialize(element);
    }
}

module.exports = {
    monerisInit: monerisInit
};
