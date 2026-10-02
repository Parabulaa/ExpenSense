// @ts-nocheck
// Secure Google Vision OCR proxy.
// Required Supabase secret: GOOGLE_VISION_API_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});
const OCR_SCAN_LIMIT = 10;

async function readWithGoogle(key: string, imageBase64: string, mimeType: string) {
  const pdf = mimeType === 'application/pdf';
  const response = await fetch(`https://vision.googleapis.com/v1/${pdf ? 'files' : 'images'}:annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ requests: [pdf ? {
      inputConfig: { content: imageBase64, mimeType },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      pages: [1, 2, 3, 4, 5],
    } : {
      image: { content: imageBase64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    }] }),
    signal: AbortSignal.timeout(20_000),
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
  const results = pdf ? payload.responses?.[0]?.responses ?? [] : [payload.responses?.[0]];
  const providerError = results.find((item: any) => item?.error)?.error;
  if (providerError) throw new Error(String(providerError.message ?? 'Google Vision could not process the file.'));
  const rawText = results.map((item: any) => String(item?.fullTextAnnotation?.text ?? '').trim()).filter(Boolean).join('\n').trim();
  if (!rawText) throw new Error("We couldn't find any text in this photo. Try a clearer, closer photo.");
  const words = results.flatMap((item: any) => item?.fullTextAnnotation?.pages ?? [])
    .flatMap((page: any) => page.blocks ?? [])
    .flatMap((block: any) => block.paragraphs ?? [])
    .flatMap((paragraph: any) => paragraph.words ?? []);
  const confidence = words.length
    ? words.reduce((sum: number, word: any) => sum + Number(word.confidence ?? 0), 0) / words.length
    : 0;
  return { rawText, confidence };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization') ?? '';
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) throw new Error('Unsupported receipt file type');
    if (typeof imageBase64 !== 'string' || imageBase64.length < 100 || imageBase64.length > 9_000_000) {
      throw new Error('Invalid image payload');
    }

    const googleKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!googleKey) throw new Error('Google Vision is not configured');
    const { data: scansRemaining, error: quotaError } = await client.rpc('claim_receipt_ocr_scan');
    if (quotaError) throw new Error('Could not verify your receipt scan allowance. Try again.');
    if (Number(scansRemaining) < 0) {
      return json({
        error: `You have used all ${OCR_SCAN_LIMIT} receipt scans for this account. You can still enter expenses manually.`,
        code: 'OCR_SCAN_LIMIT_REACHED',
        limit: OCR_SCAN_LIMIT,
        scansRemaining: 0,
      }, 429);
    }

    return json({
      ...await readWithGoogle(googleKey, imageBase64, mimeType),
      scanLimit: OCR_SCAN_LIMIT,
      scansRemaining: Number(scansRemaining),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Receipt recognition failed' }, 422);
  }
});
