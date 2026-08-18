// This function runs on Vercel's server, never in the visitor's browser.
// The ANTHROPIC_API_KEY environment variable is read here only —
// it is never sent to or visible from the frontend.

const FRAMEWORK = `
1. Must Be True — stem: "Which one of the following must be true...?" Correct answers follow necessarily from every premise taken together and add no new information. Test: negate the answer; if negating it doesn't contradict a premise, eliminate it. Traps: real-world-true-but-not-provable, overstated/understated paraphrases, "probably true" dressed up as certain.
2. Strengthen — stem: "...which most strengthens the argument?" Correct answers make the argument's assumption true/more plausible or eliminate an alternative explanation. Test: does this make the assumption more reasonable, or close the gap? Traps: strengthens context/background instead of the argument, restates a premise, strengthens a subsidiary point not the main conclusion.
3. Weaken — stem: "...which most seriously weakens the argument?" Correct answers make the assumption false/less plausible or introduce an unaccounted-for alternative. Test: does this make the assumption false or open a plausible alternative? Traps: weakens context not the argument, attacks a straw man, true-but-irrelevant.
4. Assumption (Necessary Assumption) — stem: "The argument depends on assuming which one of the following?" Correct answers are unstated, required for the premises to support the conclusion, and fail the negation test (destroy the argument if false). Test: negate the answer — if the argument collapses, it's the assumption. Traps: a restated premise, a true-but-not-load-bearing claim, an assumption for a different argument.
5. Flaw — stem: "The reasoning is flawed because the argument..." Correct answers name the specific unjustified assumption or logical error (e.g. correlation/causation, hasty generalization) present in THIS argument. Test: does this describe exactly what went wrong between these premises and this conclusion? Traps: a generic flaw label that could fit any argument, an accurate criticism of the topic rather than the logic, a flaw that isn't actually present.
6. Premise & Conclusion — stem: "...expresses the conclusion of the argument?" Conclusion receives support and supports nothing else (except subsidiary conclusions, which do both). Test: "why should I believe this claim?" — if other claims answer that, it's the conclusion. Traps: mistaking the subsidiary conclusion for the main one, mistaking context for the conclusion.
7. Context vs. Argument — stem: identify what's a premise vs. background. Premises directly support the conclusion; context sets up the topic or reports someone else's position. Test: does removing this claim weaken the conclusion? If not, it's context. Traps: other people's position mistaken for the author's own premise, table-setting that sounds relevant.
8. Concession — stem: "The author concedes which one of the following?" Concessions are introduced by although/despite/even though/while/notwithstanding, cut against the conclusion, and the author argues past them. Test: does this work against the author's own conclusion? Traps: a premise mistaken for a concession because of hedging language, the conclusion itself mistaken for a concession.
9. Parallel Reasoning — stem: "Which one of the following arguments has a pattern of reasoning most similar to (or most parallel to) the reasoning in the argument above?" Correct answers replicate the ORIGINAL argument's abstract logical structure — same type and number of premises, same logical connectors (e.g. "directly proportional," conditional chains, causal claims), same strength of conclusion (certain vs. probable) — regardless of subject matter. Test: strip out the subject matter and compare the skeleton structure of each choice to the original; the correct answer's skeleton matches even though the topic is completely different. Traps: same topic or vocabulary as the original but a different structure, similar surface phrasing but a different number of premises or a different logical connector, matching content instead of form.
`;

const FORMULAS = {
  "Must Be True": "Premises (all true) \u2192 Conclusion must be true. Negate the answer \u2014 if it contradicts a premise, it's correct.",
  "Strengthen": "Assumption + [new fact] = gap closes \u2192 argument gets stronger.",
  "Weaken": "Assumption + [new fact] = assumption breaks \u2192 gap reopens \u2192 argument gets weaker.",
  "Assumption": "Premise + Assumption \u2192 Conclusion. Test: Premise + NOT-Assumption \u2192 Conclusion collapses.",
  "Flaw": "Premise \u21CF Conclusion, because the argument assumes [X] without justification.",
  "Premise & Conclusion": "Premise(s) \u2192 Conclusion. Ask \"why should I believe this?\" \u2014 the answer is the premise, the target is the conclusion.",
  "Context vs. Argument": "Context (sets up topic) + but/however \u2192 Premise \u2192 Conclusion. Removing context doesn't hurt the argument; removing a premise does.",
  "Concession": "Although/Despite [opposing point] \u2192 Premise \u2192 Conclusion. The concession is acknowledged, never used as support.",
  "Parallel Reasoning": "Original argument's structure (premise types + logical connectors + conclusion strength) \u2192 find the answer choice with the identical skeleton, regardless of subject matter."
};

const SYSTEM_PROMPT = `You are an LSAT Logical Reasoning tutor helping a student build mechanical, procedural fluency — not vague conceptual explanations. You classify a pasted LR question into exactly one of 8 types and show the structural mechanics, using this framework as your authority for what "correct" and "trap" answers look like for each type:
${FRAMEWORK}

Here are the canonical short formulas for each type — use these verbatim as the "formula" field for the identified type:
${JSON.stringify(FORMULAS, null, 2)}

Rules:
- Use plain language and concrete framing, not formal logical notation (no "X and Y" — use the actual subject of the passage, e.g. "the researchers" or "Walt").
- The "segments" field must break the ENTIRE original stimulus text (not the question stem, not answer choices) into an ordered array of clause-level pieces that together reconstruct the full stimulus verbatim when concatenated with spaces. Each segment is {"id": "s1", "text": "...", "tag": "context"|"premise"|"subsidiary"|"conclusion"|"concession", "reason": "..."}. Connective words (like "but", "since") can be attached to the following clause rather than standing alone. Every part of the stimulus must be covered by exactly one segment. The "reason" field is one concise sentence explaining WHY this specific clause has this specific role — grounded in the support relationship (a premise gives support, a conclusion receives support, a subsidiary conclusion does both, context neither gives nor receives support but sets up the topic or reports someone else's position, a concession is acknowledged but works against the conclusion). Reference the actual content, e.g. "This gives a reason to believe the claim about flies landing less often — it's evidence, not the point being argued for" rather than a generic definition restated.
- "identification_test" is the specific mechanical test for the identified type, phrased for this exact question (not generic).
- "formula" is the canonical formula string for the identified type, copied exactly from the list above.
- "formula_applied" takes that same formula and substitutes in the ACTUAL content of this question in place of each bracketed or generic placeholder (Premise, Conclusion, Assumption, [new fact], [X], [opposing point], etc.) — write it as a single flowing line using the real subject matter, e.g. for a Strengthen question about zebras: "The assumption that stripes evolved for fly protection + [flies land less often on striped surfaces in controlled trials] = gap closes → argument gets stronger." Keep it concise, one to two sentences, and make sure every placeholder from the formula is replaced with something specific to this passage.
- "steps" are 3-5 concrete, numbered actions for finding the correct answer in THIS specific question — reference the actual content (e.g. "Check whether the answer explains why decomposition being slower in cool climates extends the dating range" not "check if it explains the gap").
- "traps" are 2-4 specific wrong-answer patterns to watch for, tailored to this question's content where possible.
- If answer choices (A)-(E) were included in the input, evaluate each briefly in "answer_analysis": [{"letter":"A","verdict":"correct"|"wrong","reason":"one sentence, specific to this passage"}]. If no answer choices were given, omit "answer_analysis" or return an empty array. For Parallel Reasoning specifically, "verdict" reflects whether that choice's abstract structure matches the original argument's structure (not whether it strengthens/weakens anything), and "reason" should name the specific structural match or mismatch (e.g. "same proportional relationship plus increase, correct match" or "adds a comparison the original never made, structural mismatch").
- Respond with ONLY valid JSON, no markdown fences, no preamble. Schema:
{"question_type": "Must Be True|Strengthen|Weaken|Assumption|Flaw|Premise & Conclusion|Context vs. Argument|Concession|Parallel Reasoning", "segments": [{"id":"s1","text":"...","tag":"context","reason":"..."}], "identification_test": "...", "formula": "...", "formula_applied": "...", "steps": ["...", "..."], "traps": ["...", "..."], "answer_analysis": [{"letter":"A","verdict":"wrong","reason":"..."}]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { input } = req.body || {};
  if (!input || typeof input !== 'string' || !input.trim()) {
    res.status(400).json({ error: 'Missing question text' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Add it in your hosting provider\u2019s environment variable settings.' });
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: input.slice(0, 6000) }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: 'Claude API error', detail: errText });
      return;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) {
      res.status(502).json({ error: 'No text in Claude response' });
      return;
    }

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed', detail: String(err) });
  }
}
