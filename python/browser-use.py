import os
import json
import httpx

from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

from browser_use import ActionResult, Agent, Browser, BrowserConfig, Controller
from browser_use.browser.context import BrowserContext, BrowserContextConfig, BrowserSession
from browser_use.browser.views import BrowserState
from browser_use.agent.views import AgentOutput
from playwright.async_api import async_playwright, Page, BrowserContext as PlaywrightContext
from langchain_openai import ChatOpenAI

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from lmnr import Laminar
Laminar.initialize(project_api_key=os.getenv('LMNR_PROJECT_API_KEY'))

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

controller = Controller()

@controller.registry.action("Enable Logging")
async def enable_logging(browser: BrowserContext):
    page = await browser.get_current_page()
    page.on("console", lambda msg: print(msg.text))
    page.on("request", lambda request: print(">>", request.method, request.url))
    page.on("response", lambda response: print("<<", response.status, response.url))
    msg = f"🛠️  Enabled logging"
    return ActionResult(extracted_content=msg, include_in_memory=True)


@controller.registry.action("Add Magic Eden extra https header origin")
async def configure_magic_eden_header(browser: BrowserContext):
    page = await browser.get_current_page()
    print("url debug", page.url)
    await page.set_extra_http_headers({"Origin": "https://magiceden.io"})
    msg = f"🛠️  Configured Magic Eden header"
    return ActionResult(extracted_content=msg, include_in_memory=True)

class ExtendedBrowserSession(BrowserSession):
    """Extended version of BrowserSession that includes current_page"""
    def __init__(
        self,
        context: PlaywrightContext,
        cached_state: Optional[dict] = None,
        current_page: Optional[Page] = None
    ):
        super().__init__(context=context, cached_state=cached_state)
        self.current_page = current_page

class UseBrowserContext(BrowserContext):
    def __init__(self, browser: Browser, config: BrowserContextConfig, session_id: str):
        super().__init__(browser, config)
        self.session_id = session_id

    async def _initialize_session(self) -> ExtendedBrowserSession:
        """Initialize a browser session."""
        playwright_browser = await self.browser.get_playwright_browser()
        context = await self._create_context(playwright_browser)

        await context.add_init_script(f'window.session = "{self.session_id}";')

        wallet_relayer_url = os.getenv('WALLET_RELAYER_URL')
        await context.add_init_script(f'window.relayer = "{wallet_relayer_url}";')

        script_paths = ["inject-wallet.js"]
        for script_path in script_paths:
            full_path = os.path.abspath(script_path)
            with open(full_path, 'r') as file:
                script_content = file.read()
                await context.add_init_script(script_content)   

        self._add_new_page_listener(context)

        self.session = ExtendedBrowserSession(
            context=context,
            cached_state=None,
        )
        
        # Get existing page or create new one
        self.session.current_page = context.pages[0] if context.pages else await context.new_page()
        
        # Initialize session state
        self.session.cached_state = await self._update_state()
        
        return self.session

async def setup_local_browser(session_id: str) -> tuple[Browser, UseBrowserContext]:
    """Set up a local Playwright browser and ensure browser_use.Browser() uses it."""
    print("Using Local Playwright Browser")
    playwright = await async_playwright().start()
    local_browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox"])

    browser = Browser()
    browser.playwright_browser = local_browser

    context = UseBrowserContext(
        browser,
        BrowserContextConfig(
            wait_for_network_idle_page_load_time=10.0,
            highlight_elements=True,
        ),
        session_id
    )

    return browser, context

async def setup_anchor_browser(session_id: str, anchor_session_id: str) -> tuple[Browser, UseBrowserContext]:
    """Set up a browser using AnchorBrowser with a known Anchor session ID and connect via its CDP URL."""
    print(f"Connecting to external browser via CDP URL...")
    anchor_api_key = os.environ["ANCHOR_BROWSER_API_KEY"]
    browser = Browser(config=BrowserConfig(        
        cdp_url=f"wss://connect.anchorbrowser.io?apiKey={anchor_api_key}&sessionId={anchor_session_id}"
    ))

    context = UseBrowserContext(
        browser,
        BrowserContextConfig(
            wait_for_network_idle_page_load_time=10.0,
            highlight_elements=True,
        ),
        session_id
    )

    return browser, context

async def setup_browser(session_id: str, anchor_session_id: Optional[str]) -> tuple[Browser, UseBrowserContext]:
    """Determine which browser setup to use."""
    load_dotenv()

    if anchor_session_id:
        return await setup_anchor_browser(session_id, anchor_session_id)

    return await setup_local_browser(session_id)

def create_step_callback(session_id: str):
    async def new_step_callback(state: BrowserState, model_output: AgentOutput, steps: int):
        log_entry = to_serializable(model_output)
        wallet_relayer_url = os.getenv('WALLET_RELAYER_URL')
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{wallet_relayer_url}/{session_id}/log",
                json=log_entry,
            )

    return new_step_callback

async def setup_agent(browser: Browser, context: UseBrowserContext, task: str, session_id: str) -> Agent:
    """Set up the browser automation agent."""
    return Agent(
        task=task,
        llm=ChatOpenAI(model="gpt-4o"),
        browser=browser,
        browser_context=context,
        use_vision=True, 
        controller=controller,
        register_new_step_callback=create_step_callback(session_id),
    )
class ChatRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    text: str

def to_serializable(obj):
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    elif isinstance(obj, list):
        return [to_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: to_serializable(value) for key, value in obj.items()}
    elif hasattr(obj, '__dict__'):
        return {key: to_serializable(value) for key, value in vars(obj).items()}
    else:
        return str(obj)  # fallback for unknown types

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if request.text.strip().lower() == "aaa": # To deploy on Autonome
        return ChatResponse(text="aaa") 
    if request.text.strip().lower() == "version": # To deploy on Autonome
        return ChatResponse(text="0.1.2") 
    browser = None
    context = None
    task = None
    session_id = None
    anchor_session_id = None
    try:
        try:
            data = json.loads(request.text)
            task = data.get("task")
            session_id = data.get("session_id")
            anchor_session_id = data.get("anchor_session_id")
        except json.JSONDecodeError:
            task = request.text
            session_id = "default"
        browser, context = await setup_browser(session_id, anchor_session_id)
        agent = await setup_agent(browser, context, task, session_id)
        result = await agent.run(max_steps=1) # Limit to 20 steps to prevent long waits
        json_ready = to_serializable(result.model_outputs())
        return ChatResponse(text=json.dumps(json_ready))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
