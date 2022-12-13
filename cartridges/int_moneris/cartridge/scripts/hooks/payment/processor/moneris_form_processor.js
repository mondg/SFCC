'use strict';

/**
 * @description Processes specified payment form
 * @param {Object} req - request
 * @param {Object} paymentForm - Payment form object
 * @param {Object} viewFormData -  Payment form data object
 * @return {Object} - Processing result
 */
function processForm(req, paymentForm, viewFormData) {
    const viewData = viewFormData;

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    if (req.form.storedPaymentUUID) {
        viewData.storedPaymentUUID = req.form.storedPaymentUUID;
    }

    return {
        error: false,
        viewData: viewData
    };
}

module.exports = {
    processForm: processForm
};
