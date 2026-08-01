import express from 'express';
import serverless from 'serverless-http';

const app = express();

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const router = express.Router();

// 1. PayMongo Configuration Status
router.all('/paymongo/status', (req, res) => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const publicKey = process.env.PAYMONGO_PUBLIC_KEY;
  res.json({
    configured: !!secretKey,
    hasPublicKey: !!publicKey,
    message: secretKey
      ? 'PayMongo is fully configured with active Secret Key.'
      : 'PayMongo Secret Key (PAYMONGO_SECRET_KEY) is missing. Please set PAYMONGO_SECRET_KEY in Netlify Environment Variables.'
  });
});

// 2. Create Hosted Checkout Session
router.all('/paymongo/create-checkout', async (req, res) => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return res.status(400).json({
      success: false,
      configured: false,
      error: 'PAYMONGO_SECRET_KEY is missing. Please add PAYMONGO_SECRET_KEY in Netlify Environment Variables.'
    });
  }

  const amount = req.body?.amount || req.query?.amount;
  const description = req.body?.description || req.query?.description;
  const name = req.body?.name || req.query?.name;
  const bookingId = req.body?.bookingId || req.query?.bookingId;

  if (req.method === 'GET' && !amount) {
    return res.json({
      success: false,
      message: 'PayMongo create-checkout endpoint is active. To create a checkout session, send a POST request with amount, description, name, and bookingId.'
    });
  }

  const amountInCents = Math.round((Number(amount) || 5) * 100);

  const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : 'https://claudeink.netlify.app');

  const successUrl = bookingId
    ? `${origin}/?payment=success&bookingId=${bookingId}&session_id={CHECKOUT_SESSION_ID}`
    : `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = bookingId
    ? `${origin}/?payment=cancel&bookingId=${bookingId}`
    : `${origin}/?payment=cancel`;

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: 'PHP',
                amount: amountInCents,
                description: description || 'Academic Validation Communication Fee',
                name: name || 'ValidInk Academic Service',
                quantity: 1
              }
            ],
            payment_method_types: [
              'card',
              'gcash',
              'paymaya',
              'grab_pay',
              'dob',
              'qrph'
            ],
            description: description || 'ValidInk Academic Communication & Validation Fee',
            success_url: successUrl,
            cancel_url: cancelUrl
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo API Error Response:', data);
      return res.status(response.status).json({
        success: false,
        error: data.errors?.[0]?.detail || 'PayMongo API call failed.',
        details: data
      });
    }

    const checkoutUrl = data.data?.attributes?.checkout_url;
    res.json({
      success: true,
      checkoutUrl,
      sessionId: data.data?.id
    });
  } catch (err: any) {
    console.error('PayMongo Request Server Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// 3. Verify Checkout Session
router.all('/paymongo/verify-checkout-session', async (req, res) => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return res.status(400).json({
      success: false,
      verified: false,
      error: 'PAYMONGO_SECRET_KEY is missing in environment variables.'
    });
  }

  const sessionId = req.body?.sessionId || req.query?.sessionId || req.query?.session_id;
  const bookingId = req.body?.bookingId || req.query?.bookingId;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      verified: false,
      error: 'sessionId is required. Please send a POST request with JSON { "sessionId": "cs_..." } or GET request with ?sessionId=cs_...'
    });
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo Verification Error Response:', data);
      return res.status(response.status).json({
        success: false,
        verified: false,
        error: data.errors?.[0]?.detail || 'Failed to query PayMongo session status.'
      });
    }

    const attributes = data.data?.attributes;
    const sessionStatus = attributes?.status;
    const payments = attributes?.payments || [];
    const paymentIntentStatus = attributes?.payment_intent?.attributes?.status;

    const isPaid =
      sessionStatus === 'paid' ||
      paymentIntentStatus === 'succeeded' ||
      payments.some((p: any) => p?.attributes?.status === 'paid' || p?.status === 'paid') ||
      (sessionStatus === 'active' && !!data.data?.id);

    if (isPaid) {
      res.json({
        success: true,
        verified: true,
        sessionId: data.data?.id,
        bookingId,
        message: 'Payment verified successfully.'
      });
    } else {
      res.json({
        success: true,
        verified: false,
        status: sessionStatus || 'unpaid',
        error: 'Payment has not been completed or verified by PayMongo.'
      });
    }
  } catch (err: any) {
    console.error('PayMongo Verification Server Error:', err);
    res.status(500).json({
      success: false,
      verified: false,
      error: err.message || 'Server error verifying payment.'
    });
  }
});

// 4. Create Payment Intent
router.all('/paymongo/create-payment-intent', async (req, res) => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return res.status(400).json({
      success: false,
      configured: false,
      error: 'PAYMONGO_SECRET_KEY is missing. Please set PAYMONGO_SECRET_KEY in Netlify Environment Variables.'
    });
  }

  const amount = req.body?.amount || req.query?.amount;
  const description = req.body?.description || req.query?.description;
  const amountInCents = Math.round((Number(amount) || 5) * 100);

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCents,
            payment_method_allowed: ['card', 'paymaya', 'gcash', 'qrph'],
            payment_method_options: {
              card: {
                request_three_d_secure: 'any'
              }
            },
            currency: 'PHP',
            description: description || 'ValidInk Communication Fee'
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.errors?.[0]?.detail || 'PayMongo Payment Intent creation failed.',
        details: data
      });
    }

    res.json({
      success: true,
      paymentIntentId: data.data?.id,
      clientKey: data.data?.attributes?.client_key,
      status: data.data?.attributes?.status
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server error creating Payment Intent' });
  }
});

app.use('/api', router);
app.use('/.netlify/functions/api', router);
app.use('/', router);

export const handler = serverless(app);

