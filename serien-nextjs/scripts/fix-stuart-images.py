"""
Hotfix: Set poster + generate backdrop for "Stuart Fails to Save the Universe".

Context: TMDB has a poster but no backdrop (series is In Production).
We update posterPath from TMDB and generate a contextually appropriate sci-fi
backdrop via Gemini Nano Banana, save it to /public/series-backdrops/ and
write the URL into series.backdropLocalUrl.
"""
import os
import sys
import base64
import asyncio
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/serien-nextjs/.env")

TMDB_ID = 287620
SLUG = "stuart-fails-to-save-the-universe"
POSTER_PATH = "/5fM1PWx8ncFSVTUMJ4WhvRPLBPp.jpg"

PROMPT = """Create a wide cinematic backdrop image for a sci-fi comedy TV series titled "Stuart Fails to Save the Universe".

Style: Cosmic, vibrant nebula in deep space, swirling galaxies, pastel pinks and electric blues mixed with deep cosmic purples. Stars scattered like glitter. A small silhouette of a tiny lone astronaut floating off-center, looking slightly lost or comically overwhelmed by the scale. Mood: humorous yet awe-inspiring, like a Pixar-meets-Wes-Anderson space scene.

NO text, NO logos, NO recognizable characters from existing media.
Aspect ratio: 16:9 wide cinematic backdrop.
Lighting: dramatic with soft glow on the astronaut figure.
Final usage: TV series hero/backdrop image for a streaming detail page."""


def get_db_url():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL missing")
    return url


async def generate_backdrop():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"backdrop-{TMDB_ID}-{int(asyncio.get_event_loop().time() * 1000)}",
        system_message="You are an expert cinematic concept artist.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    print("→ Generating backdrop via Nano Banana...")
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    if not images:
        raise RuntimeError(f"No image returned. Text: {text}")
    return base64.b64decode(images[0]["data"])


async def main():
    img_bytes = await generate_backdrop()

    # Save to public path so Next.js serves it as a static asset
    out_dir = "/app/serien-nextjs/public/series-backdrops"
    os.makedirs(out_dir, exist_ok=True)
    out_path = f"{out_dir}/{TMDB_ID}.jpg"

    # Resize/crop to a standard 16:9 backdrop ratio (1920x1080)
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(img_bytes))
    target_w, target_h = 1920, 1080
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    target_ratio = target_w / target_h
    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        left = (src_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, src_h))
    else:
        new_h = int(src_w / target_ratio)
        top = (src_h - new_h) // 2
        img = img.crop((0, top, src_w, top + new_h))
    img = img.resize((target_w, target_h), Image.LANCZOS).convert("RGB")
    img.save(out_path, "JPEG", quality=88)
    print(f"✓ Backdrop saved: {out_path} @ {img.size}")

    public_url = f"/series-backdrops/{TMDB_ID}.jpg"

    # Update DB: poster + backdropLocalUrl
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE series
                   SET "posterPath" = %s,
                       "backdropLocalUrl" = %s,
                       "updatedAt" = NOW()
                   WHERE slug = %s""",
                (POSTER_PATH, public_url, SLUG),
            )
            print(f"✓ DB updated: posterPath={POSTER_PATH}, backdropLocalUrl={public_url}")
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    asyncio.run(main())
