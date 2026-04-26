"""
Generate Facebook Cover Photo for Serien.de
- Style: Collage of TV series posters/stills with logo + tagline overlay
- Tagline: "Täglich neue Seriennews"
- Output: 1640 x 624 px (FB cover, retina-ready)

Usage: cd /app/serien-nextjs && python3 scripts/generate-fb-cover.py
"""
import asyncio
import os
import base64
import sys
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/serien-nextjs/.env")

api_key = os.getenv("EMERGENT_LLM_KEY")
if not api_key:
    print("EMERGENT_LLM_KEY not set", file=sys.stderr)
    sys.exit(1)

PROMPT = """Create a high-quality Facebook cover photo for a German TV-series news website called "serien.de".

Style: Cinematic collage of popular TV series stills/posters arranged in a dynamic mosaic.
Show partial glimpses of recognizable streaming-era series imagery: dark moody scenes, vibrant action shots,
character close-ups, neon-lit cityscapes — evoking shows like Stranger Things, The Last of Us, House of the Dragon,
Wednesday, Squid Game style aesthetic. Cinematic color grading, deep blacks, accent highlights.

Composition: Wide horizontal cover banner format (about 2.6:1 ratio, like a Facebook cover photo).
The collage must have a subtle gradient overlay (dark, semi-transparent) so the text stays legible.

Text overlay (center-left or center, large, bold, sans-serif, white):
- Headline (large): "serien.de"
- Tagline (medium, below headline): "Täglich neue Seriennews"

The text must be sharp, readable, and properly spelled in German. No typos.
Add a subtle cyan accent line under the logo as a brand signature.

Avoid: any actual visible logos of streaming services (Netflix, Prime, Disney+ logos).
Avoid: any real text from existing shows. Avoid: blurry text, AI-typical artifacts, distorted faces.

Aspect ratio: 21:8 (wide cinematic banner). Final usage: Facebook page cover."""


async def main():
    chat = LlmChat(
        api_key=api_key,
        session_id="fb-cover-serien-de",
        system_message="You are an expert visual designer creating brand cover banners.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    msg = UserMessage(text=PROMPT)
    print("→ Generating image via Nano Banana ...")
    text, images = await chat.send_message_multimodal_response(msg)

    print(f"Text response: {text[:200] if text else '(none)'}")
    if not images:
        print("ERROR: No image returned", file=sys.stderr)
        sys.exit(1)

    out_dir = "/app/serien-nextjs/public/branding"
    os.makedirs(out_dir, exist_ok=True)
    for i, img in enumerate(images):
        ext = "png" if "png" in img.get("mime_type", "") else "jpg"
        path = f"{out_dir}/fb-cover-v{i + 1}.{ext}"
        with open(path, "wb") as f:
            f.write(base64.b64decode(img["data"]))
        print(f"✓ Saved: {path}")


if __name__ == "__main__":
    asyncio.run(main())
