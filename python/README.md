# AI Agent

## Detail

When a user starts a task, our AI Agent launches inside a Trusted Execution Environment (TEE) to ensure secure execution. The agent controls a headless browser using the Chrome DevTools Protocol (CDP) over WebSocket, powered by our browser automation module.

As the browser runs, it captures key vision data—such as screenshots and DOM elements—which is then sent to OpenAI for analysis. Based on the AI’s output, the agent determines the next action, whether it’s clicking a button, typing text, or navigating to another page, and executes it in real time.

Meanwhile, a Headless Web3 Provider is injected into the browser. This simulates a typical window.ethereum interface found in dApps. Any signing or transaction requests are intercepted and securely forwarded to the user's real wallet—ensuring that your private key is never exposed and always stays under your control.

Every prompt, decision, and result can be securely stored in our Recall Storage Network, enabling users to manage, import, and share reusable knowledge modules (like workflows and prompts). This opens up the possibility for on-chain transparent knowledge sharing, enhanced with TEE attestation to ensure authenticity, security, and trust across agents and users.

## Main implementation

https://github.com/taijusanagi/2025-trifecta/blob/main/python/browser-use.py

## Deployment

- Docker Image: taijusanagi/dbrowseruse:0.1.2
- Custom Autonome Framework: dbrowser012
- Deployed Autonome Agent: dbu-qtiadr
