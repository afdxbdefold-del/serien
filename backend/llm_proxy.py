"""
LLM Proxy Service using emergentintegrations
Provides REST API for Next.js to call LLM services
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import emergentintegrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:
    print("⚠️  emergentintegrations not found, installing...")
    import subprocess
    subprocess.check_call([
        "pip", "install", "emergentintegrations", 
        "--extra-index-url", "https://d33sy5i8bnduwe.cloudfront.net/simple/"
    ])
    from emergentintegrations.llm.chat import LlmChat, UserMessage

app = FastAPI(title="LLM Proxy Service")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[Message]
    response_format: Optional[Dict] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1500

class ChatResponse(BaseModel):
    content: str
    model: str
    usage: Optional[Dict] = None

@app.post("/v1/chat/completions", response_model=ChatResponse)
async def chat_completion(request: ChatRequest):
    """
    OpenAI-compatible chat completion endpoint
    """
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not found")
    
    try:
        # Extract system message
        system_message = None
        user_messages = []
        
        for msg in request.messages:
            if msg.role == "system":
                system_message = msg.content
            elif msg.role == "user":
                user_messages.append(msg.content)
        
        if not system_message:
            system_message = "You are a helpful assistant."
        
        # Initialize LlmChat
        chat = LlmChat(
            api_key=api_key,
            session_id=f"session-{os.urandom(8).hex()}",
            system_message=system_message
        )
        
        # Set model
        provider = "openai"
        model_name = request.model
        
        if "claude" in model_name:
            provider = "anthropic"
        elif "gemini" in model_name:
            provider = "gemini"
        
        chat.with_model(provider, model_name)
        
        # Send message (combine all user messages)
        combined_user_message = "\n\n".join(user_messages)
        user_msg = UserMessage(text=combined_user_message)
        
        response_text = await chat.send_message(user_msg)
        
        return ChatResponse(
            content=response_text,
            model=request.model,
            usage={"total_tokens": 0}  # emergentintegrations doesn't return usage
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "llm-proxy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
