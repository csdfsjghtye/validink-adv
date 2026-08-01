import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const secretKey = Netlify.env.get('PAYMONGO_SECRET_KEY')

  if (!secretKey) {
    return Response.json(
      {
        success: false,
        configured: false,
        error: 'PAYMONGO_SECRET_KEY is missing. Please set PAYMONGO_SECRET_KEY in the Netlify environment variables.'
      },
      { status: 400 }
    )
  }

  const { amount, description } = await req.json()
  const amountInCents = Math.round((Number(amount) || 5) * 100)

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`

    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json'
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
    })

    const data = await response.json()

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: data.errors?.[0]?.detail || 'PayMongo Payment Intent creation failed.',
          details: data
        },
        { status: response.status }
      )
    }

    return Response.json({
      success: true,
      paymentIntentId: data.data?.id,
      clientKey: data.data?.attributes?.client_key,
      status: data.data?.attributes?.status
    })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || 'Server error creating Payment Intent' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/paymongo/create-payment-intent',
  method: 'POST'
}
