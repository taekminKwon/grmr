import fs from "fs";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const diff = fs.readFileSync("/tmp/pr.diff", "utf8");

const prNumber = process.env.PR_NUMBER;
const repository = process.env.REPOSITORY;
const title = process.env.PR_TITLE ?? "";
const body = process.env.PR_BODY ?? "";

const prompt = `
You are an independent senior software engineer performing a Pull Request review.
Review it by Korean language.

## PR

Title:
${title}

Description:
${body}

## Review policy

Only report meaningful problems.

Focus on:

1. Functional bugs
2. Requirement violations
3. Regression risks
4. Security vulnerabilities
5. Data integrity problems
6. Transaction or concurrency issues
7. Incorrect exception handling
8. Missing important validation
9. Missing important tests
10. Architectural violations

Do NOT report:

- formatting
- subjective naming preferences
- trivial style issues
- speculative problems with no realistic failure scenario
- refactoring suggestions that do not fix an actual problem

For every issue provide:

Severity: CRITICAL | HIGH | MEDIUM | LOW
File:
Problem:
Why it matters:
Recommended fix:

At the end provide exactly one result:

RESULT: PASS

or

RESULT: CHANGES_REQUIRED

If there are no meaningful issues, return PASS.

## Pull Request Diff

\`\`\`diff
${diff}
\`\`\`
`;

const response = await client.responses.create({
  model: "gpt-5.4-mini",
  input: prompt,
});

const review = response.output_text;

const githubResponse = await fetch(
  `https://api.github.com/repos/${repository}/issues/${prNumber}/comments`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: `## 🤖 GPT Code Review

${review}`,
    }),
  }
);

if (!githubResponse.ok) {
  const error = await githubResponse.text();
  throw new Error(
    `GitHub API failed: ${githubResponse.status} ${error}`
  );
}

console.log(review);
