import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const secretKey = Netlify.env.get('PAYMONGO_SECRET_KEY')

  if (!secretKey) {
    return Response.json(
      {
        success: false,
        configured: false,
        error: 'PAYMONGO_SECRET_KEY is missing. Please add PAYMONGO_SECRET_KEY in the Netlify environment variables.'
      },
      { status: 400 }
    )
  }

  const { amount, description, name, bookingId } = await req.json()
  // PayMongo amounts are in cents (e.g. 500 PHP = 50000 cents)
  const amountInCents = Math.round((Number(amount) || 5) * 100)

  const origin = req.headers.get('origin') || new URL(req.url).origin
  const successUrl = bookingId
    ? `${origin}/?payment=success&bookingId=${bookingId}&session_id={CHECKOUT_SESSION_ID}`
    : `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = bookingId
    ? `${origin}/?payment=cancel&bookingId=${bookingId}`
    : `${origin}/?payment=cancel`

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json'
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
            payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'dob', 'qrph'],
            description: description || 'ValidInk Academic Communication & Validation Fee',
            success_url: successUrl,
            cancel_url: cancelUrl
          }
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('PayMongo API Error Response:', data)
      return Response.json(
        {
          success: false,
          error: data.errors?.[0]?.detail || 'PayMongo API call failed.',
          details: data
        },
        { status: response.status }
      )
    }

    const checkoutUrl = data.data?.attributes?.checkout_url
    return Response.json({
      success: true,
      checkoutUrl,
      sessionId: data.data?.id
    })
  } catch (err: any) {
    console.error('PayMongo Request Server Error:', err)
    return Response.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/paymongo/create-checkout',
  method: 'POST'
}
