import os
import requests

from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

from browser_use import Agent, Browser, BrowserConfig
from browser_use.browser.context import BrowserContext, BrowserContextConfig, BrowserSession
from playwright.async_api import async_playwright, Page, BrowserContext as PlaywrightContext
from langchain_openai import ChatOpenAI

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StartRequest(BaseModel):
    session_id: str

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
    local_browser = await playwright.chromium.launch(headless=False)

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

async def setup_anchor_browser(session_id: str) -> tuple[Browser, UseBrowserContext]:
    """Set up browser and context using AnchorBrowser."""
    print("Using AnchorBrowser")
    anchor_api_key = os.environ["ANCHOR_BROWSER_API_KEY"]
    response = requests.post(
        "https://api.anchorbrowser.io/api/sessions",
        headers={
            "anchor-api-key": anchor_api_key,
            "Content-Type": "application/json",
        },
        json={
            "headless": False,
            "recording": {"active": True},
        }
    ).json()
    
    print("Live View URL:", response["live_view_url"])
    
    browser = Browser(config=BrowserConfig(
        cdp_url=f"wss://connect.anchorbrowser.io?apiKey={anchor_api_key}&sessionId={response['id']}"
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

async def setup_browser(session_id: str) -> tuple[Browser, UseBrowserContext]:
    """Determine whether to use Local Playwright or AnchorBrowser."""
    load_dotenv()
    
    use_local = os.getenv("USE_LOCAL_BROWSER", "false").lower() == "true"

    if use_local:
        return await setup_local_browser(session_id)
    else:
        if "ANCHOR_BROWSER_API_KEY" not in os.environ:
            raise EnvironmentError("ANCHOR_BROWSER_API_KEY is required for AnchorBrowser.")
        return await setup_anchor_browser(session_id)

async def setup_agent(browser: Browser, context: UseBrowserContext) -> Agent:
    """Set up the browser automation agent."""
    return Agent(
        task="Go to https://metamask.github.io/test-dapp/ and check the wallet connection",
        llm=ChatOpenAI(model="gpt-4o-mini"),
        browser=browser,
        browser_context=context,
        use_vision=True, 
    )

@app.post("/start")
async def start(request: StartRequest):
    """API endpoint to start the browser with a user-defined session ID."""
    try:
        session_id = request.session_id
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required.")

        browser, context = await setup_browser(session_id)
        agent = await setup_agent(browser, context)
        await agent.run()
        return {"status": "success", "message": "Browser started successfully", "session_id": session_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
