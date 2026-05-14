const WARNING_RULES = [
  {
    label: "cyclists nearby",
    patterns: [
      /\bfietsers\b/i,
      /\bfietspad(?:en)?\b/i,
      /\bmountainbikers?\b/i,
      /\bmountainbike(?:route|pad|s)?\b/i,
      /\bmtb(?:-routes?)?\b/i,
      /\bwielrenners?\b/i,
    ],
    excludedPatterns: [
      /\bgeen fietsers?\b/i,
      /\bgeen fietspad(?:en)?\b/i,
      /\bgeen mountainbikers?\b/i,
      /\bgeen wielrenners?\b/i,
      /\bzonder fietsers?\b/i,
    ],
  },
  {
    label: "livestock nearby",
    patterns: [
      /\bschapen\b/i,
      /\bkoeien\b/i,
      /\bpaarden\b/i,
      /\bpony's?\b/i,
      /\bvee\b/i,
      /\bgrazers?\b/i,
      /\bbegrazing\b/i,
      /\brunderen\b/i,
    ],
  },
  {
    label: "muddy after rain",
    patterns: [
      /\bmodder(?:ig|poel|poten)?\b/i,
      /\bdrassig\b/i,
      /\blaarzen\b/i,
      /\bnatte voeten\b/i,
      /\berg nat\b/i,
      /\bzeer nat\b/i,
    ],
    excludedPatterns: [
      /\bniet (?:snel )?modderig\b/i,
      /\bgeen modder\b/i,
      /\bniet door de modder\b/i,
    ],
  },
  {
    label: "traffic nearby",
    patterns: [
      /\bdrukke weg\b/i,
      /\b(?:lopen|wandelen|route|pad|stukje|moet|moeten)[^.!?]{0,80}\blangs de weg\b/i,
      /\blangs de weg[^.!?]{0,80}\b(?:lopen|wandelen|route|pad|stukje|moet|moeten)\b/i,
      /\baan de weg\b/i,
      /\bauto'?s? rijden\b/i,
      /\b(?:druk|veel|gevaarlijk|opletten(?: voor)?|pas op(?: voor)?|langs|naast|dicht bij|vlakbij)[^.!?]{0,80}\bverkeer\b/i,
      /\bverkeer\b[^.!?]{0,80}\b(?:druk|gevaarlijk|langs|naast|dicht bij|vlakbij)\b/i,
      /\bautoweg\b/i,
      /\bsnelweg\b/i,
      /\bprovinciale weg\b/i,
    ],
    excludedPatterns: [
      /\bgeen verkeer\b/i,
      /\bniet bang[^.!?]{0,80}\bverkeer\b/i,
      /\bweinig verkeer\b/i,
      /\bgeen auto's?\b/i,
    ],
  },
];

function getReviewText(review) {
  return typeof review?.text === "string" ? review.text : "";
}

function getSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasWarningMatch(rule, reviewText) {
  return getSentences(reviewText).some(
    (sentence) =>
      rule.patterns.some((pattern) => pattern.test(sentence)) &&
      !(rule.excludedPatterns ?? []).some((pattern) => pattern.test(sentence)),
  );
}

export function inferLocationWarnings(reviews = []) {
  const reviewText = reviews.map(getReviewText).join("\n");

  return WARNING_RULES.filter((rule) => hasWarningMatch(rule, reviewText)).map(
    (rule) => rule.label,
  );
}
