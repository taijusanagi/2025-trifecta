from langchain_openai import ChatOpenAI
from browser_use import Agent, Browser
from dotenv import load_dotenv

import asyncio

load_dotenv()

llm = ChatOpenAI(model="gpt-4o")

async def main():
    browser = Browser()
    playwright_browser = await browser.get_playwright_browser()
    context = await playwright_browser.new_context()
    agent = Agent(
        task="Go to https://metamask.github.io/test-dapp/ and check the wallet connection",
        llm=llm,
        browser=browser
    )
    result = await agent.run()
    print(result)

asyncio.run(main())
