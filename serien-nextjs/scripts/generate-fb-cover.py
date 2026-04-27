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

PROMPT = """Create a Facebook cover photo for "serien.de" (German TV-series news site).

CRITICAL BACKGROUND REQUIREMENT:
The ENTIRE background must be filled with VIBRANT CYAN color #06B6D4 (hsl 189, 94%, 43%).
This cyan dominates 60-70% of the visible area. Think: bright turquoise/cyan canvas
like a brand poster. NOT a black background. NOT just a thin cyan border.

LAYOUT:
On top of the cyan background, place a partial collage strip (centered horizontally,
medium height, like a ribbon) of cinematic TV-style imagery: dramatic dark scenes,
silhouetted characters, abstract neon cityscapes, atmospheric forest scenes,
moody close-ups. The collage is SMALLER than the cyan area and acts as visual texture.
Apply a subtle dark overlay on the collage strip.

NO recognizable show titles, NO logos, NO brand names, NO real actors' faces close-up.
Use ABSTRACT cinematic moods only — silhouettes, lighting, atmosphere.

TEXT (centered, large, bold sans-serif, white):
- "serien.de" (very large, hero font weight)
- "Täglich neue Seriennews" (medium, below)
- White underline accent between them

The text sits ON the cyan background area (not on the collage), so it's crisp and readable.

Style references: Modern brand banner, Spotify Wrapped poster vibe, Netflix-news landing page.
Aspect ratio: 21:8 wide cinematic banner.
Colors: Cyan #06B6D4 dominant, white text, dark accent strip with imagery.
NO BLACK BACKGROUND. The cyan must be unmistakably dominant."""


async def main():
    chat = LlmChat(
        api_key=api_key,
        session_id=f"fb-cover-serien-de-cyan-{int(asyncio.get_event_loop().time() * 1000)}",
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
        path = f"{out_dir}/fb-cover-cyan-v2.{ext}"
        with open(path, "wb") as f:
            f.write(base64.b64decode(img["data"]))
        print(f"✓ Saved: {path}")


if __name__ == "__main__":
    asyncio.run(main())
