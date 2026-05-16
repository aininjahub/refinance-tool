# Should I Refinance? — AI-Powered Mortgage Refinance Tool

Free tool that gives users an honest, AI-powered analysis of whether refinancing makes sense.

## Stack
- Frontend: Cloudflare Pages (static HTML/JS)
- API: Cloudflare Worker (proxies Claude API)
- AI: Claude Sonnet

## Deploy
Worker: `cd worker && wrangler deploy && wrangler secret put CLAUDE_API_KEY`
Frontend: Auto-deploys via Cloudflare Pages connected to this repo.
