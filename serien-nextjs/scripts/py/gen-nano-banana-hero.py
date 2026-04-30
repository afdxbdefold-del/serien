#!/usr/bin/env python3
"""
Nano Banana (Gemini) hero-image generator.

Called by `lib/nano-banana-hero.ts` via subprocess when an article has no
TMDB backdrop available. Takes a German prompt via argv and writes a PNG
to the given output path. Exits 0 on success, non-zero on failure.

Usage:
    python gen-nano-banana-hero.py <output_path> <session_id>
    (prompt is read from stdin to avoid argv length / escaping issues)
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage


async def main() -> int:
    if len(sys.argv) < 3:
        print("usage: gen-nano-banana-hero.py <out_path> <session_id>", file=sys.stderr)
        return 2

    out_path = Path(sys.argv[1])
    session_id = sys.argv[2]
    prompt = sys.stdin.read().strip()
    if not prompt:
        print("empty prompt on stdin", file=sys.stderr)
        return 3

    load_dotenv()
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("EMERGENT_LLM_KEY not set", file=sys.stderr)
        return 4

    # New LlmChat instance per call (required by playbook).
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=(
            "Du bist ein visueller Regisseur fuer ein deutsches Serien-Magazin. "
            "Erzeuge atmosphaerische, kinematische 16:9-Hero-Bilder. "
            "Keine Logos, keine Wasserzeichen, kein Text im Bild."
        ),
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    msg = UserMessage(text=prompt)
    try:
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        print(f"gemini call failed: {e}", file=sys.stderr)
        return 5

    if not images:
        print("no images returned", file=sys.stderr)
        return 6

    img = images[0]
    try:
        image_bytes = base64.b64decode(img["data"])
    except Exception as e:
        print(f"base64 decode failed: {e}", file=sys.stderr)
        return 7

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(image_bytes)
    print(f"ok mime={img.get('mime_type', '?')} bytes={len(image_bytes)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
