var WORKER_URL = "https://refinance-tool-api.YOUR_SUBDOMAIN.workers.dev";

var form = document.getElementById("refi-form");
var submitBtn = document.getElementById("submit-btn");
var btnText = document.getElementById("btn-text");
var loadingHint = document.getElementById("loading-hint");
var formSection = document.getElementById("form-section");
var resultsSection = document.getElementById("results-section");
var errorMsg = document.getElementById("error-msg");

form.addEventListener("submit", function(e) { e.preventDefault(); analyze(); });

function analyze() {
  var input = {
    balance: document.getElementById("balance").value,
    currentRate: document.getElementById("currentRate").value,
    remainingYears: document.getElementById("remainingYears").value,
    creditScore: document.getElementById("creditScore").value,
    newRate: document.getElementById("newRate").value || null,
    newTerm: document.getElementById("newTerm").value || null,
    stayYears: document.getElementById("stayYears").value,
    cashOut: document.getElementById("cashOut").value || null,
  };
  submitBtn.disabled = true;
  btnText.textContent = "Analyzing your numbers";
  loadingHint.style.display = "block";
  errorMsg.style.display = "none";
  startLoadingDots();
  fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) { showError(data.error); return; }
    renderResults(data, input);
  })
  .catch(function(err) {
    console.error(err);
    showError("Analysis failed. Check your connection and try again.");
  });
}

var dotsInterval;
function startLoadingDots() {
  var dots = 0;
  dotsInterval = setInterval(function() {
    dots = (dots + 1) % 4;
    btnText.textContent = "Analyzing your numbers" + ".".repeat(dots);
  }, 400);
}
function stopLoadingDots() {
  clearInterval(dotsInterval);
  submitBtn.disabled = false;
  btnText.textContent = "Analyze My Refinance";
  loadingHint.style.display = "none";
}
function showError(msg) {
  stopLoadingDots();
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
}
function fmt(n) {
  if (n == null || isNaN(n)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function escapeHtml(str) { var d = document.createElement("div"); d.textContent = str; return d.innerHTML; }

function renderResults(result, input) {
  stopLoadingDots();
  formSection.style.display = "none";
  resultsSection.style.display = "block";
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

  var verdicts = {
    refinance: { label: "Refinance", color: "#1a7a4c", bg: "#e8f5ee", icon: "\u2713", tag: "The numbers work in your favor." },
    dont_refinance: { label: "Don't Refinance", color: "#b8372b", bg: "#fdeeed", icon: "\u2715", tag: "The math doesn't support it right now." },
    maybe: { label: "It Depends", color: "#b07d10", bg: "#fef9e7", icon: "~", tag: "There's a case, but it's not clear-cut." },
  };
  var v = verdicts[result.verdict] || verdicts.maybe;
  var stayMonths = Number(input.stayYears) * 12;
  var noSavings = result.monthly_savings <= 0;
  var neverBreakeven = result.breakeven_months > 360 || noSavings;
  var breakevenSub = noSavings ? "No savings to recoup costs" : result.breakeven_months > stayMonths ? "After you'd move \u26A0\uFE0F" : "Before you'd move \u2713";
  var savingsColor = result.monthly_savings > 0 ? "#1a7a4c" : result.monthly_savings < 0 ? "#b8372b" : "#1a202c";
  var interestColor = result.total_interest_saved > 0 ? "#1a7a4c" : result.total_interest_saved < 0 ? "#b8372b" : "#1a202c";
  var breakevenColor = neverBreakeven ? "#b8372b" : "#1a202c";

  var html = '';
  html += '<div class="verdict-card" style="background:' + v.bg + ';border-left:5px solid ' + v.color + '">';
  html += '<div class="verdict-row">';
  html += '<span class="verdict-icon" style="color:' + v.color + ';background:' + v.color + '18">' + v.icon + '</span>';
  html += '<div class="verdict-text"><h2 style="color:' + v.color + '">' + v.label + '</h2><p>' + v.tag + '</p></div>';
  html += '<span class="confidence-badge" style="border-color:' + v.color + ';color:' + v.color + '">' + result.confidence + ' confidence</span>';
  html += '</div></div>';

  html += '<div class="numbers-grid">';
  html += '<div class="num-card"><span class="num-label">Monthly Savings</span><span class="num-value" style="color:' + savingsColor + '">' + fmt(result.monthly_savings) + '</span></div>';
  html += '<div class="num-card"><span class="num-label">Total Interest Saved</span><span class="num-value" style="color:' + interestColor + '">' + fmt(result.total_interest_saved) + '</span></div>';
  html += '<div class="num-card"><span class="num-label">Est. Closing Costs</span><span class="num-value">' + fmt(result.closing_cost_estimate) + '</span></div>';
  html += '<div class="num-card"><span class="num-label">Breakeven</span><span class="num-value" style="color:' + breakevenColor + '">' + (neverBreakeven ? "Never" : result.breakeven_months + " mo") + '</span><span class="num-sub">' + breakevenSub + '</span></div>';
  html += '</div>';

  var paragraphs = (result.explanation || "").split("\n").filter(function(p) { return p.trim(); });
  html += '<div class="content-card"><h3>The Analysis</h3>';
  paragraphs.forEach(function(p) { html += '<p class="explain-para">' + escapeHtml(p) + '</p>'; });
  html += '</div>';

  if (result.key_factors && result.key_factors.length > 0) {
    html += '<div class="content-card"><h3>Key Factors</h3>';
    result.key_factors.forEach(function(f, i) {
      html += '<div class="factor-row"><span class="factor-num">' + (i + 1) + '</span><span class="factor-text">' + escapeHtml(f) + '</span></div>';
    });
    html += '</div>';
  }

  if (result.warnings && result.warnings.length > 0) {
    html += '<div class="warnings-card"><h3>Watch Out For</h3>';
    result.warnings.forEach(function(w) {
      html += '<div class="warning-row"><span class="warning-icon">\u26A0</span><span class="warning-text">' + escapeHtml(w) + '</span></div>';
    });
    html += '</div>';
  }

  if (result.recommended_actions && result.recommended_actions.length > 0) {
    html += '<div class="content-card"><h3>Your Next Step</h3>';
    result.recommended_actions.forEach(function(action) {
      var links = AFFILIATE_LINKS[action];
      if (!links) return;
      if (links.primary) {
        html += '<a href="' + links.primary.url + '" target="_blank" rel="noopener" class="cta-primary">';
        html += '<span class="cta-label">' + links.primary.name + '</span>';
        html += '<span class="cta-sub">' + links.primary.cta + '</span>';
        html += '<span class="cta-arrow">\u2192</span></a>';
      }
      if (links.secondary) {
        html += '<a href="' + links.secondary.url + '" target="_blank" rel="noopener" class="cta-secondary">';
        html += '<span class="cta-label">' + links.secondary.name + '</span>';
        html += '<span class="cta-sub">' + links.secondary.cta + '</span>';
        html += '<span class="cta-arrow">\u2192</span></a>';
      }
    });
    html += '</div>';
  }

  if (!result.recommended_actions || result.recommended_actions.length === 0) {
    html += '<div class="no-action-card">';
    html += '<p class="no-action-main">Based on your numbers, we don\'t think refinancing makes sense right now. No affiliate links, no upsell \u2014 just an honest answer.</p>';
    html += '<p class="no-action-sub">Check back if rates drop or your situation changes.</p></div>';
  }

  html += '<button class="reset-btn" onclick="resetTool()">\u2190 Run Another Scenario</button>';
  html += '<p class="disclosure">Some links on this site are from partners who compensate us. This does not influence the analysis above \u2014 when the math says don\'t refinance, we say don\'t refinance. This tool provides estimates, not financial advice.</p>';
  resultsSection.innerHTML = html;
}

function resetTool() {
  resultsSection.style.display = "none";
  resultsSection.innerHTML = "";
  formSection.style.display = "block";
  formSection.scrollIntoView({ behavior: "smooth", block: "start" });
}
