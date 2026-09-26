// @ts-nocheck
// Secure OCR proxy. Deploy with: supabase functions deploy process-receipt
// Secrets (set with `supabase secrets set`):
//   OCR_SPACE_API_KEY      free OCR.space key — used first when present
//   GOOGLE_VISION_API_KEY  optional; used when OCR.space is missing or fails
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** OCR.space free tier: no card, ~1 MB per image. Engine 2 handles receipts' numbers and layout best. */
async function readWithOcrSpace(key: string, imageBase64: string) {
  const form = new FormData();
  form.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
  form.append('language', 'eng');
  form.append('OCREngine', '2');
  // Keeps each printed line on its own line, which is what the receipt parser reads.
  form.append('isTable', 'true');
  form.append('scale', 'true');
  form.append('detectOrientation', 'true');
  const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', headers: { apikey: key }, body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(`OCR.space request failed (${response.status}).`);
  if (payload.IsErroredOnProcessing) {
    const reason = [payload.ErrorMessage].flat().filter(Boolean).join(' ');
    if (/size|exceed/i.test(reason)) throw new Error('The image is too large for the free OCR service. Try a closer photo.');
    if (/api ?key|invalid/i.test(reason)) throw new Error('The OCR.space API key is invalid.');
    throw new Error(reason || 'OCR.space could not read this image.');
  }
  const rawText = (payload.ParsedResults ?? []).map((result: any) => result.ParsedText ?? '').join('\n').replace(/\t+/g, '  ').trim();
  // OCR.space does not report a confidence; a clean read with real text is treated as high.
  return { rawText, confidence: rawText.length > 20 ? 0.85 : 0.4 };
}

async function readWithGoogle(key: string, imageBase64: string) {
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
  return { rawText, confidence };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization') ?? '';
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { imageBase64 } = await request.json();
    if (typeof imageBase64 !== 'string' || imageBase64.length > 9_000_000) throw new Error('Invalid image payload');

    const ocrSpaceKey = Deno.env.get('OCR_SPACE_API_KEY');
    const googleKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!ocrSpaceKey && !googleKey) throw new Error('OCR provider is not configured');

    // Free provider first; Google only if it is configured and the free one fails.
    let firstError: Error | null = null;
    if (ocrSpaceKey) {
      try { return json(await readWithOcrSpace(ocrSpaceKey, imageBase64)); }
      catch (error) { firstError = error instanceof Error ? error : new Error('OCR.space failed'); }
    }
    if (googleKey) {
      try { return json(await readWithGoogle(googleKey, imageBase64)); }
      catch (error) { throw firstError ?? error; }
    }
    throw firstError ?? new Error('Receipt recognition failed');
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Receipt recognition failed' }, 422);
  }
});
