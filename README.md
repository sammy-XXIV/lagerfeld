# Fit Check

A2MCP agent for OKX.AI — rates an outfit photo against a specific occasion and returns a structured verdict (not a beauty score, an occasion-appropriateness score).

## Endpoint

`POST /fit-check`
- multipart form: `photo` (jpeg/png/webp file), `occasion` (one of the values in `src/rubric.ts`)
- returns: `{ occasion, dress_code_match, color_coordination, fit_silhouette, occasion_flags, overall_score, verdict, one_fix }`

## Run locally

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm run dev
```

Test:
```
curl -X POST http://localhost:3000/fit-check \
  -F "photo=@/path/to/outfit.jpg" \
  -F "occasion=job_interview"
```

## Not done yet
- x402 payment-required flow (needed before this can go live as a paid A2MCP listing on OKX.AI)
- ASP registration on OKX.AI (via the Onchain OS skill, per okx.ai/tutorial/asp)
