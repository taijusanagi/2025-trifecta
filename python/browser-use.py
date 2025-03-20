import asyncio
import os

from langchain_openai import ChatOpenAI
from browser_use import Agent, Browser
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="gpt-4o")

async def main():
    browser = Browser()
    playwright_browser = await browser.get_playwright_browser()
    context = await playwright_browser.new_context()
    page = await context.new_page()

    ethers_script_path = os.path.abspath("ethers.js")
    inject_wallet_script_path = os.path.abspath("inject-wallet.js")

    with open(ethers_script_path, 'r') as file:
        script_content = file.read()
        await context.add_init_script(script_content)     

    with open(inject_wallet_script_path, 'r') as file:
        script_content = file.read()
        await context.add_init_script(script_content)

    print("Init script added, navigating to test dApp...")
    await page.goto("https://metamask.github.io/test-dapp/")
    await asyncio.sleep(120)
    # agent = Agent(
    #     task="Go to https://metamask.github.io/test-dapp/ and check the wallet connection",
    #     llm=llm,
    #     browser=browser
    # )
    # result = await agent.run()
    # print(result)

asyncio.run(main())
