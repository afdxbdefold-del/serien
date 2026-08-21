"""
Character Content Generator (Python)
Generates discover-optimized content for fictional character pages.
Läuft primär über eigenen OPENAI_API_KEY (GPT-5.4, direktes OpenAI-SDK),
Emergent LLM-Proxy nur noch als Fallback.
"""

import os
import sys
import json
import asyncio

OPENAI_KEY = os.environ.get('OPENAI_API_KEY')
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')

async def generate_character_content(character_name: str, series_name: str, actor_name: str = None, fandom_context: str = None):
    """Generate all content sections for a character page"""
    
    # Build context section
    context_parts = []
    if actor_name:
        context_parts.append(f"Darsteller: {actor_name}")
    if fandom_context:
        context_parts.append(f"\nZUSÄTZLICHER KONTEXT VON FANDOM.COM:\n{fandom_context[:1500]}")  # Limit to avoid token overflow
    
    context_str = "\n".join(context_parts) if context_parts else "Darsteller unbekannt"
    
    prompt = f"""Du bist ein Serien-Redakteur und erstellst eine Autoritätsseite über die fiktive Figur "{character_name}" aus der Serie "{series_name}".

WICHTIGE REGELN:
- Schreibe journalistisch, NICHT im Wiki-Stil
- Keine Aufzählungen, nur Fließtext
- Keine Spoiler ohne klare Kennzeichnung
- Keine generischen KI-Phrasen
- Keine Marketing-Sprache
- Faktenbasiert, keine Spekulationen
- Nutze die Fandom-Informationen als Basis, formuliere aber journalistisch um

KONTEXT:
{context_str}

AUFGABE: Erstelle folgende Abschnitte:

1. SHORT_DESCRIPTION (2-3 Sätze)
   - Kurze Einordnung: Wer ist die Figur? Warum relevant?

2. WHO_IS (150-250 Wörter)
   - Charakterbeschreibung
   - Rolle innerhalb der Serie
   - Bedeutung für Handlung und Ton
   - Verständlich erklären

3. ROLE_IN_SERIES (150-200 Wörter)
   - Charakterentwicklung
   - Innere Konflikte
   - Narrative Funktion
   - Neutral erklärend

4. IMPORTANCE (100-150 Wörter)
   - Einfluss auf Story
   - Beziehungen zu anderen Figuren
   - Dynamiken

5. APPEARANCES (100-150 Wörter)
   - Wichtige Story-Momente (spoilerfrei oder markiert)
   - Zentrale Wendepunkte

6. QA (3-5 figurenspezifische Fragen)
   - KEINE generischen Fragen
   - Figuren-individuell
   - Antworten: 2-4 Sätze

7. META_TITLE (max 60 Zeichen)
   Format: "{character_name} ({series_name}) – Rolle, Bedeutung & Hintergrund"

8. META_DESCRIPTION (140-160 Zeichen)
   Fokus: Figur + Serie + Relevanz

AUSGABEFORMAT (JSON):
{{
  "shortDescription": "...",
  "whoIsContent": "...",
  "roleInSeriesContent": "...",
  "importanceContent": "...",
  "appearancesContent": "...",
  "qa": [
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}}
  ],
  "metaTitle": "...",
  "metaDescription": "..."
}}

Antworte NUR mit dem JSON, keine Einleitung."""

    try:
        if OPENAI_KEY:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=OPENAI_KEY)
            completion = await client.chat.completions.create(
                model='gpt-5.4',
                messages=[
                    {"role": "system", "content": "Du bist ein professioneller Serien-Redakteur."},
                    {"role": "user", "content": prompt},
                ],
                max_completion_tokens=3000,
            )
            response = completion.choices[0].message.content or ''
        else:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=EMERGENT_KEY,
                session_id=f"char-gen-{character_name}",
                system_message="Du bist ein professioneller Serien-Redakteur."
            ).with_model('openai', 'gpt-4o')

            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)

        # Extract JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if not json_match:
            raise Exception('No JSON found in LLM response')

        content = json.loads(json_match.group(0))

        # Validate required fields
        if not content.get('shortDescription') or not content.get('whoIsContent'):
            raise Exception('Missing required content fields')

        return content

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        raise

async def main():
    if len(sys.argv) < 3:
        print("Usage: python3 generate-character-content.py <character_name> <series_name> [actor_name] [--fandom-context <context>]", file=sys.stderr)
        sys.exit(1)

    character_name = sys.argv[1]
    series_name = sys.argv[2]
    actor_name = None
    fandom_context = None
    
    # Parse arguments
    i = 3
    while i < len(sys.argv):
        if sys.argv[i] == '--fandom-context' and i + 1 < len(sys.argv):
            fandom_context = sys.argv[i + 1]
            i += 2
        else:
            if not actor_name:
                actor_name = sys.argv[i]
            i += 1

    result = await generate_character_content(character_name, series_name, actor_name, fandom_context)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
