import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route: Check PayMongo Configuration Status
  app.get('/api/paymongo/status', (req, res) => {
    const hasSecret = !!process.env.PAYMONGO_SECRET_KEY;
    const hasPublic = !!process.env.PAYMONGO_PUBLIC_KEY;
    res.json({
      configured: hasSecret,
      hasPublicKey: hasPublic,
      message: hasSecret
        ? 'PayMongo is fully configured with active Secret Key.'
        : 'PayMongo Secret Key (PAYMONGO_SECRET_KEY) is missing. Please add it in AI Studio Secrets panel or .env file.'
    });
  });

  // API route: Create PayMongo Hosted Checkout Session (GCash, Maya, Card, QRPH)
  app.post('/api/paymongo/create-checkout', async (req, res) => {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
      return res.status(400).json({
        success: false,
        configured: false,
        error: 'PAYMONGO_SECRET_KEY is missing. Please add PAYMONGO_SECRET_KEY in AI Studio Settings/Secrets or .env file.'
      });
    }

    const { amount, description, name, bookingId } = req.body;
    // PayMongo amounts are in cents (e.g. 500 PHP = 50000 cents)
    const amountInCents = Math.round((Number(amount) || 5) * 100);

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
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

  // API route: Verify PayMongo Checkout Session status
  app.post('/api/paymongo/verify-checkout-session', async (req, res) => {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'PAYMONGO_SECRET_KEY is missing. Cannot verify payment with PayMongo.'
      });
    }

    const { sessionId, bookingId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'sessionId is required for payment verification.'
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

      // Check if session status is 'paid', or payment intent succeeded, or any payment status is 'paid', or session active upon success redirect
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

  // API route: Create PayMongo Payment Intent for direct API authorization
  app.post('/api/paymongo/create-payment-intent', async (req, res) => {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
      return res.status(400).json({
        success: false,
        configured: false,
        error: 'PAYMONGO_SECRET_KEY is missing. Please set PAYMONGO_SECRET_KEY in Secrets or .env file.'
      });
    }

    const { amount, description } = req.body;
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

  // Vite middleware in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
