import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const secretKey = Netlify.env.get('PAYMONGO_SECRET_KEY')

  if (!secretKey) {
    return Response.json(
      {
        success: false,
        verified: false,
        error: 'PAYMONGO_SECRET_KEY is missing. Cannot verify payment with PayMongo.'
      },
      { status: 400 }
    )
  }

  const { sessionId, bookingId } = await req.json()

  if (!sessionId) {
    return Response.json(
      { success: false, verified: false, error: 'sessionId is required for payment verification.' },
      { status: 400 }
    )
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`

    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('PayMongo Verification Error Response:', data)
      return Response.json(
        {
          success: false,
          verified: false,
          error: data.errors?.[0]?.detail || 'Failed to query PayMongo session status.'
        },
        { status: response.status }
      )
    }

    const attributes = data.data?.attributes
    const sessionStatus = attributes?.status
    const payments = attributes?.payments || []
    const paymentIntentStatus = attributes?.payment_intent?.attributes?.status

    const isPaid =
      sessionStatus === 'paid' ||
      paymentIntentStatus === 'succeeded' ||
      payments.some((p: any) => p?.attributes?.status === 'paid' || p?.status === 'paid')

    if (isPaid) {
      return Response.json({
        success: true,
        verified: true,
        sessionId: data.data?.id,
        bookingId,
        message: 'Payment verified successfully.'
      })
    }

    return Response.json({
      success: true,
      verified: false,
      status: sessionStatus || 'unpaid',
      error: 'Payment has not been completed or verified by PayMongo.'
    })
  } catch (err: any) {
    console.error('PayMongo Verification Server Error:', err)
    return Response.json(
      { success: false, verified: false, error: err.message || 'Server error verifying payment.' },
      { status: 500 }
    )
  }
}

export const config: Config = {
  path: '/api/paymongo/verify-checkout-session',
  method: 'POST'
}
