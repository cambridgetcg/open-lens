const FORBIDDEN_VERDICT_PATTERNS = [
  { code: "truth_verdict", pattern: /\b(?:true|false|truth|truthful|truthfully|truthfulness|untrue|untruthful|factual|factually|accurate|inaccurate|correct|incorrect|fabricate|fabricates|fabricated|fabricating|fabrication|made[- ]up)\b/iu },
  { code: "lie_verdict", pattern: /\b(?:lie|lies|lied|lying|liar|liars)\b/iu },
  { code: "deception_verdict", pattern: /\b(?:deceive|deceives|deceived|deceiving|deception|deceptive|dishonest|dishonesty)\b/iu },
  { code: "sincerity_verdict", pattern: /\b(?:sincere|sincerely|sincerity|insincere|insincerely|insincerity|honest|honestly|honesty)\b/iu },
  { code: "belief_verdict", pattern: /\b(?:believe|believes|believed|believing|know|knows|knew|known|knowing|aware|awareness|think|thinks|thought)\b/iu },
  { code: "intent_verdict", pattern: /\b(?:intend|intends|intended|intending|intent|intention|intentions|intentional|intentionally|deliberate|deliberately|knowingly|want|wants|wanted|wanting|aim|aims|aimed|aiming|try|tries|tried|trying|motive|motives|motivated|motivation|agenda|purposeful|purposefully|hide|hides|hid|hidden|hiding|conceal|conceals|concealed|concealing)\b/iu },
  { code: "manipulation_verdict", pattern: /\b(?:manipulate|manipulates|manipulated|manipulating|manipulation|manipulative|evade|evades|evaded|evading|evasion|evasive)\b/iu },
  { code: "mental_state_verdict", pattern: /\b(?:remorse|remorseful|contrite|contrition|guilty|ashamed|angry|afraid|fearful)\b/iu },
];

function outputStrings(reading) {
  const strings = [reading.text, reading.register];
  if (Array.isArray(reading.assumptions)) strings.push(...reading.assumptions);
  if (Array.isArray(reading.alternatives)) {
    for (const alternative of reading.alternatives) {
      if (typeof alternative === "string") strings.push(alternative);
      else if (alternative && typeof alternative === "object") {
        strings.push(alternative.text, alternative.condition);
      }
    }
  }
  return strings.filter((value) => typeof value === "string");
}

export function rejectedVerdict(reading) {
  const output = outputStrings(reading).join("\n");
  for (const rule of FORBIDDEN_VERDICT_PATTERNS) {
    if (rule.pattern.test(output)) return rule.code;
  }
  return null;
}
