const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');

const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://heyplace.app';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY env var');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function isInstagramUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)instagram\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

function extractMetaTag(html, property) {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(re) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')
  );
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

async function resolveVideoAndCaption(igUrl) {
  const res = await fetch(igUrl, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) {
    throw new Error(`Could not fetch Instagram page (status ${res.status}). It may be private or removed.`);
  }
  const html = await res.text();

  const videoUrl =
    extractMetaTag(html, 'og:video:secure_url') || extractMetaTag(html, 'og:video');
  if (!videoUrl) {
    throw new Error('No public video found at this link — it may be a photo post, private, or Instagram changed its page format.');
  }
  const caption = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'og:description') || '';
  return { videoUrl, caption };
}

async function downloadVideo(videoUrl) {
  const res = await fetch(videoUrl, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) {
    throw new Error(`Could not download the video (status ${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `ig-${crypto.randomUUID()}.mp4`);
  fs.writeFileSync(tmpPath, buf);
  return tmpPath;
}

async function extractPlaceFromVideo(tmpPath, caption) {
  const uploaded = await ai.files.upload({ file: tmpPath, config: { mimeType: 'video/mp4' } });

  const prompt = `You are looking at a short social media video. Listen to any speech and read any on-screen text/captions burned into the video. Identify the specific place, venue, restaurant, or location being shown or mentioned.

Caption text from the post (may be empty or unrelated): "${caption}"

Respond with ONLY a JSON object, no markdown, in this exact shape:
{"placeNameGuess": string or null, "addressGuess": string or null, "confidence": "high"|"medium"|"low", "rawNotes": string}

If you cannot identify any specific place, set placeNameGuess to null and explain briefly in rawNotes.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      { role: 'user', parts: [{ fileData: { fileUri: uploaded.uri, mimeType: 'video/mp4' } }, { text: prompt }] },
    ],
  });

  const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return a usable result.');
  }
  return JSON.parse(jsonMatch[0]);
}

app.post('/api/extract-place', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !isInstagramUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
  }

  let tmpPath;
  try {
    const { videoUrl, caption } = await resolveVideoAndCaption(url);
    tmpPath = await downloadVideo(videoUrl);
    const result = await extractPlaceFromVideo(tmpPath, caption);
    return res.json(result);
  } catch (err) {
    console.error('extract-place failed:', err.message);
    return res.status(502).json({ error: err.message || 'Failed to extract a place from this link.' });
  } finally {
    if (tmpPath) {
      fs.unlink(tmpPath, () => {});
    }
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`heyplace-extractor listening on :${PORT}`);
});
