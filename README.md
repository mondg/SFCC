# Salesforce Commerce Cloud Moneris Cartridge

Moneris provides a LINK cartridge to integrate with Salesforce Commerce Cloud (SFCC). This cartridge enables a SFCC storefront to use the Moneris payment. The cartridge supports SFRA version 6.1.0 or higher.

## Description

This cartridge supports only the default Salesforce checkout. It is not recommended to customize the cartridge, because it could make it difficult to upgrade and maintain your integration. The customized integrations is not supported.

## Requirements

It is required to be Moneris partner to use the cartridge. You can do this [here](https://www.moneris.com/en/partners/forms/general)

## Installation

### Cartridge

The Moneris LINK cartridge can be used with Storefront Reference Architecture (SFRA).
1. Add **int_moneris** cartridge to your project (**cartridges** folder)
2. Add the cartridge name to cartridge path of site
3. Build the client side artefacts:
```
npm install
npm run build
```

### Metadata

1. Open the **metadata/site_import/sites/** folder.
2. Rename the **yourSiteId** folder to the ID of your site in the Business Manager.
3. Zip the **site_import** folder.
4. In the Business Manager, go to **Administration > Site Development > Site Import & Export**, upload and import the zipped file.

After the import, attributes moneris[attributeName] are added to:
+ **Administration > Site Development > System Object Types > Site Preferences > Attribute Definitions**
+ **Administration > Site Development > System Object Types > Order > Attribute Definitions**
+ **Administration > Site Development > System Object Types > Customer Payment Instrument > Attribute - Definition**

New **MONERIS_CHECKOUT** Payment Processor and **MONERIS_PAYMENT** Payment Method are added.

The jobs are added to **Administration > Operations > Services**:
+ moneris.preAuthCompletion
+ moneris.preload
+ moneris.receipt
+ moneris.refund
+ moneris.void

Also, the following services are added to **Administration > Operations > Job**:
+ MonerisConfirmPayment
+ MonerisRefund
+ MonerisPreAuthCompletion

## Confiuration

### Site Preferences
Preference ID | Preference Name | Description
--- | --- | ---
monerisApiToken | Moneris Checkout API Token | Unique alphanumeric string assignedupon merchant account activation
monerisCheckoutId | Moneris Checkout ID | Identifies your Moneris Checkout configuration; this is given to you when you configure your page in the Merchant Resource Center
monerisStoreId | Moneris Checkout Store ID | Unique identifier provided by Moneris upon merchant account set up
monerisAskCVV | Moneris Checkout Ask CVV | When set to True, Moneris Checkout will prompt the cardholder to enter their CVV when they select a payment card that has been stored as a token
monerisDynamicDescriptor | Moneris Checkout Dynamis Descriptor | Merchant-defined description sent on a per-transaction basis that will appear on the credit card statement appen- ded to the merchant’s business name. Dependent on the card issuer, the statement will typically show the dynamic descriptor appended to the merchant's existing business name separated by the "/" character; addi- tional characters will be truncated. NOTE: The 22-character maximum limit must take the "/" into account as one of the characters
monerisLng | Moneris Checkout Language | Determines which language Moneris Checkout will display information in

### Services

Name | Description
--- | ---
moneris.preload | Is used for preload request to receive the ticket
moneris.receipt | Is used for receipt request to receive the transaction receipt
moneris.preAuthCompletetion | Is used for completion call for shipped orders with Pre-Authorization transaction type
moneris.refund | Is used for refund of cancelled order
emoneris.void | Is used for refund of cancelled order

### Jobs
Job ID | Parameters | Description | Schedule
--- | --- | --- | ---
MonerisConfirmPayment | **timeFrame** - Number of minutes set as the limit for how long ago an order could be created (default is 15) | In situation when customer received confirmation on client side and closed page before redirect to confirmation page, this job picks up uncompleted orders and check the transactions if they were submited and set orders appropriate statuses | every 15 minutes
MonerisRefund |  | The job picks up cancelled orders and does Void/Refund transaction calls to Moneris | every 1 hour
MonerisPreAuthCompletion |  | This job picks up the shipped orders with Pre_Auth transactions and does copmletion calls to Moneris | every 15 minutes

## Customization

You can change the behaviour on clients side by overwritten the callbacks that are used by Moneris widget. Currently callbacks have been implemented in **int_moneris/cartridge/client/default/js/checkout/monerisCheckout.js**. For your purpose you can override the callbacks that Moneris triggers on client-side from your custom code:

Event Name | When triggers | Example
--- | --- | ---
page_loaded | called once the Moneris Checkout is loaded. | myCheckout.setCallback("page_loaded",myPageLoad);
cancel_transaction | called in the event the cardholder presses the cancel button in Moneris Checkout. | myCheckout.setCallback("cancel_transaction",myCancelTransaction);
error_event | when an error occurs during the checkout process | myCheckout.setCallback("error_event",myErrorEvent);
payment_receipt | when transaction is complete and receipt is ready to be collected. | myCheckout.setCallback("payment_receipt",myPaymentReceipt);
payment_complete | called once Moneris Checkout has completed payment. | myCheckout.setCallback("payment_complete",myPaymentComplete);
page_closed | called when user is on payment page and try to <ul><li>Close window</li><li>Click on Browser Back Button</li><li>JavaScript error occurred from Moneris Script</li></ul> | myCheckout.setCallback("page_closed",myPageClosed);
payment_submitted | called will be triggered when cardholder clicks Checkout button and payment processing is started. | myCheckout.setCallback("payment_submitted",myPaymentSubmitted);

To get more information about the callbacks see [Moneris documentation](https://developer.moneris.com/livedemo/checkout/callbacks/guide/dotnet).

## Support

If you have a feature request, or spotted a bug or a technical problem, create a GitHub issue. For other questions, contact our [support team](https://www.moneris.com/en/support).

## License

MIT license see LICENSE.
