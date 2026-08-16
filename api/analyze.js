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
`;

const SYSTEM_PROMPT = `You are an LSAT Logical Reasoning tutor helping a student build mechanical, procedural fluency — not vague conceptual explanations. You classify a pasted LR question into exactly one of 8 types and show the structural mechanics, using this framework as your authority for what "correct" and "trap" answers look like for each type:
${FRAMEWORK}

Rules:
- Use plain language and concrete framing, not formal logical notation (no "X and Y" — use the actual subject of the passage, e.g. "the researchers" or "Walt").
- The "annotated_stimulus" field must be the ENTIRE original stimulus text (not the question stem, not answer choices), reproduced verbatim but wrapped with span tags around each clause: <span class="tag tag-context">...</span>, <span class="tag tag-premise">...</span>, <span class="tag tag-subsidiary">...</span> (for a claim that both gives and receives support), <span class="tag tag-conclusion">...</span>, <span class="tag tag-concession">...</span>. Untagged connective words (like "but", "since") can stay outside spans. Every part of the stimulus should be accounted for in some tag.
- "identification_test" is the specific mechanical test for the identified type, phrased for this exact question (not generic).
- "steps" are 3-5 concrete, numbered actions for finding the correct answer in THIS specific question — reference the actual content (e.g. "Check whether the answer explains why decomposition being slower in cool climates extends the dating range" not "check if it explains the gap").
- "traps" are 2-4 specific wrong-answer patterns to watch for, tailored to this question's content where possible.
- If answer choices (A)-(E) were included in the input, evaluate each briefly in "answer_analysis": [{"letter":"A","verdict":"correct"|"wrong","reason":"one sentence, specific to this passage"}]. If no answer choices were given, omit "answer_analysis" or return an empty array.
- Respond with ONLY valid JSON, no markdown fences, no preamble. Schema:
{"question_type": "Must Be True|Strengthen|Weaken|Assumption|Flaw|Premise & Conclusion|Context vs. Argument|Concession", "annotated_stimulus": "...", "identification_test": "...", "steps": ["...", "..."], "traps": ["...", "..."], "answer_analysis": [{"letter":"A","verdict":"wrong","reason":"..."}]}`;

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
        max_tokens: 1000,
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
