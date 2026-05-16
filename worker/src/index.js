var SYSTEM_PROMPT = "You are a mortgage refinance analysis engine. Given a user's current mortgage details and goals, analyze whether refinancing makes financial sense.\n\nReturn ONLY valid JSON with this exact structure — no markdown, no backticks, no preamble:\n{\n  \"verdict\": \"refinance\" | \"dont_refinance\" | \"maybe\",\n  \"confidence\": \"strong\" | \"moderate\" | \"weak\",\n  \"monthly_savings\": number,\n  \"total_interest_saved\": number,\n  \"closing_cost_estimate\": number,\n  \"breakeven_months\": number,\n  \"explanation\": \"2-3 paragraph plain-language explanation. Be specific about the numbers. Speak like a smart friend who happens to know mortgages, not like a bank brochure.\",\n  \"key_factors\": [\"list of 3-4 key factors that drove the recommendation\"],\n  \"warnings\": [\"any risks or caveats — be honest\"],\n  \"recommended_actions\": [\"mortgage_refi\"] or [\"mortgage_refi\", \"home_insurance_review\"] or []\n}\n\nRules:\n- Be brutally honest. If the numbers don't support refinancing, say so clearly.\n- If no new rate provided, estimate based on credit score and current market (assume 30-year average around 6.5-7%).\n- For closing costs, estimate 2-4% of loan amount.\n- Calculate breakeven = closing costs / monthly savings.\n- Factor in how long they plan to stay — if breakeven is after they plan to leave, that's a dealbreaker.\n- Use empty recommended_actions array if recommendation is NOT to refinance.\n- Consider opportunity cost of closing costs if invested elsewhere.\n- Do not mention any specific companies or products. Do not include any URLs.\n- Keep explanation clear and jargon-free.";

var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    try {
      var input = await request.json();
      var required = ["balance", "currentRate", "remainingYears", "stayYears"];
      for (var i = 0; i < required.length; i++) {
        if (!input[required[i]]) {
          return jsonResponse({ error: "Missing required field: " + required[i] }, 400);
        }
      }
      var clean = {
        balance: Number(input.balance),
        currentRate: Number(input.currentRate),
        remainingYears: Number(input.remainingYears),
        stayYears: Number(input.stayYears),
        creditScore: String(input.creditScore || "Good (700-749)"),
        newRate: input.newRate ? Number(input.newRate) : null,
        newTerm: input.newTerm ? Number(input.newTerm) : null,
        cashOut: input.cashOut ? Number(input.cashOut) : null,
      };
      if (clean.balance <= 0 || clean.balance > 10000000) {
        return jsonResponse({ error: "Loan balance must be between $1 and $10,000,000" }, 400);
      }
      var userPrompt = buildPrompt(clean);
      var response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: ""model": "claude-sonnet-4-6",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!response.ok) {
        return jsonResponse({ error: "Analysis service temporarily unavailable. Try again." }, 502);
      }
      var data = await response.json();
      var text = data.content && data.content[0] ? data.content[0].text : "";
      var cleaned = text.replace(/```json|```/g, "").trim();
      var analysis;
      try { analysis = JSON.parse(cleaned); } catch (e) {
        return jsonResponse({ error: "Analysis produced an unexpected format. Try again." }, 500);
      }
      return jsonResponse(analysis, 200);
    } catch (err) {
      return jsonResponse({ error: "Something went wrong. Try again." }, 500);
    }
  },
};

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS),
  });
}

function buildPrompt(input) {
  var prompt = "Analyze this refinance scenario:\n";
  prompt += "- Current loan balance: $" + input.balance.toLocaleString() + "\n";
  prompt += "- Current interest rate: " + input.currentRate + "%\n";
  prompt += "- Remaining term: " + input.remainingYears + " years\n";
  prompt += "- Credit score range: " + input.creditScore + "\n";
  prompt += "- Plans to stay in home: " + input.stayYears + " years\n";
  if (input.newRate) {
    prompt += "- New rate offered: " + input.newRate + "%\n";
  } else {
    prompt += "- New rate: Not yet quoted — estimate based on credit score and current market\n";
  }
  if (input.newTerm) { prompt += "- Considering new term: " + input.newTerm + " years\n"; }
  if (input.cashOut) { prompt += "- Wants cash-out refinance: Yes, approximately $" + input.cashOut.toLocaleString() + "\n"; }
  return prompt;
}
