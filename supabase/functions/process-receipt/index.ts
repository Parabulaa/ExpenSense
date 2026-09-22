// @ts-nocheck
// Secure OCR proxy. Deploy with: supabase functions deploy process-receipt
// Then set GOOGLE_VISION_API_KEY using `supabase secrets set`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization') ?? '';
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    const { imageBase64 } = await request.json();
    if (typeof imageBase64 !== 'string' || imageBase64.length > 9_000_000) throw new Error('Invalid image payload');
    const key = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!key) throw new Error('OCR provider is not configured');
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ requests: [{ image: { content: imageBase64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
    });
    if (!response.ok) {
      const provider = await response.json().catch(() => ({}));
      const reason = String(provider?.error?.message ?? 'The OCR provider rejected the request');
      if (/billing/i.test(reason)) throw new Error('Google Cloud billing is not enabled for the Vision project.');
      if (/API key|invalid key/i.test(reason)) throw new Error('The Google Vision API key is invalid or has not propagated yet.');
      if (/has not been used|disabled|not enabled/i.test(reason)) throw new Error('Cloud Vision API is not enabled in the Google project.');
      if (/restricted|permission|forbidden/i.test(reason)) throw new Error('The Google Vision API key restrictions rejected this request.');
      throw new Error(`Google Vision request failed (${response.status}).`);
    }
    const payload = await response.json();
    const result = payload.responses?.[0];
    if (result?.error) throw new Error(String(result.error.message ?? 'Google Vision could not process the image.'));
    const rawText = result?.fullTextAnnotation?.text ?? '';
    const words = (result?.fullTextAnnotation?.pages ?? []).flatMap((page: any) => page.blocks ?? []).flatMap((block: any) => block.paragraphs ?? []).flatMap((paragraph: any) => paragraph.words ?? []);
    const confidence = words.length ? words.reduce((sum: number, word: any) => sum + Number(word.confidence ?? 0), 0) / words.length : 0;
    return new Response(JSON.stringify({ rawText, confidence }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Receipt recognition failed' }), { status: 422, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
