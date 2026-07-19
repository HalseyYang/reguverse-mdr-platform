# AI Extraction And DeepSeek Configuration

The platform should support AI-assisted extraction from uploaded context files.

## Purpose

Uploaded device documents should help populate the project and device profile automatically.

The extraction result should not directly overwrite profile fields. It should produce editable candidates that the user can review, modify, and apply.

## Supported Extraction Flow

```text
Upload file
  -> parse text
  -> deterministic field extraction
  -> optional AI extraction
  -> merge candidates
  -> user review
  -> apply to profile
```

## DeepSeek-Compatible Configuration

The backend is designed to support OpenAI-compatible chat completion APIs.

Example local `.env` values:

```text
AI_PROVIDER=deepseek
AI_BASE_URL=https://api.deepseek.com
AI_PROFILE_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=sk-your-key-here
```

API keys must not be committed to GitHub.

## AI Config UI

The AI Tools page should include a configuration panel for:

- Provider
- Base URL
- Model
- API key status
- Save configuration action

## Extraction Quality Requirements

The extraction layer should support:

- Field synonyms
- Heading plus following paragraph extraction
- Chinese and English labels
- Source snippets
- Confidence level
- Manual editing
- Accept extracted value
- Keep existing profile value

## Human Review

AI output should never silently replace regulatory fields. Users should be able to inspect source text and confirm each important field.
