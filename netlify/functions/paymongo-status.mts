import type { Config } from '@netlify/functions'

export default async () => {
  const hasSecret = !!Netlify.env.get('PAYMONGO_SECRET_KEY')
  const hasPublic = !!Netlify.env.get('PAYMONGO_PUBLIC_KEY')

  return Response.json({
    configured: hasSecret,
    hasPublicKey: hasPublic,
    message: hasSecret
      ? 'PayMongo is fully configured with active Secret Key.'
      : 'PayMongo Secret Key (PAYMONGO_SECRET_KEY) is missing. Please add it in the Netlify environment variables.'
  })
}

export const config: Config = {
  path: '/api/paymongo/status',
  method: 'GET'
}
