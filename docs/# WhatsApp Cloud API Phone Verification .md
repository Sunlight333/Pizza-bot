# WhatsApp Cloud API Phone Verification Guide

Performing phone verification for the Meta WhatsApp Cloud API involves a few critical steps. The process spans preparing the number, triggering the verification code inside the **Meta Developer Console**, and ensuring backend registration compliance.

---

## Step 1: Pre-Requisites & Number Preparation

Before doing anything in the portal, your phone number must meet these criteria:
* **No Existing WhatsApp Accounts:** The number **cannot** be currently linked to a standard WhatsApp or WhatsApp Business mobile app. If it is, you must go into the mobile app's settings and select **Delete My Account** first. 
* **Capability:** The number must be able to receive international SMS or voice calls to get the One-Time Password (OTP).

---

## Step 2: Add the Number in the Meta Developer Console

1. Log in to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Go to **My Apps** and select your configured WhatsApp app.
3. In the left-hand menu, navigate to **WhatsApp** > **API Setup**.
4. Scroll down to the bottom of the page and click the **Add phone number** button.

---

## Step 3: Configure Profile and Request OTP

1. **Business Info:** Enter your **WhatsApp Business display name**. Ensure this matches your legal entity or public branding exactly (generic names like "Support" or "Bot" may face rejection).
2. Select your **Timezone**, **Category**, and an optional business description, then click **Next**.
3. **Enter Number:** Select your country code and enter the phone number.
4. **Verification Method:** Choose either **Text Message (SMS)** or **Phone Call**, then click **Next**.

---

## Step 4: Submit the Verification Code

1. Meta will send a 6-digit verification code via the method you chose.
2. Enter the OTP into the prompt on your Meta Developer screen and click **Next** / **Finish**.

---

## ⚠️ Crucial Troubleshooting (Why Status Stays "Pending")

Many developers get stuck after entering the OTP because the number status still reads "Pending" or "Disconnected." To successfully finalize the activation, check the following:

* **Display Name Approval:** Meta manually or algorithmically reviews your display name. The number will not fully activate until the status shifts from *Pending* to *Approved*.
* **Registering via Graph API / 2FA PIN:** To securely complete the registration loop on Meta's infrastructure, you often need to attach a 2FA PIN. This can be forced via your third-party software container or by sending a `POST` request directly to the Meta Graph API:

```http
POST [https://graph.facebook.com/v22.0/](https://graph.facebook.com/v22.0/)<YOUR_PHONE_NUMBER_ID>/register
Authorization: Bearer <YOUR_PERMANENT_ACCESS_TOKEN>
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "pin": "666666" 
}