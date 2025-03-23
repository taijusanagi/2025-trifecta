# Glider

![top](./nodejs/app/public/ogp-image.png)

## Description

### 1. Service Overview

Glider is an AI-powered platform that autonomously executes front-end browser tasks for Web3 operations. Instead of manually navigating between various dApps, Glider handles the entire UI interaction automatically. The user only needs to approve transactions by signing them with their own pre-owned EOA wallet—ensuring that only transactions you explicitly authorize are executed, with no risk of runaway AI behavior.

### 2. Problem

Manual switching between multiple wallets and dApps is inefficient. Existing AI-plus-crypto tools are limited to SDK/API interactions, failing to cover full UI automation and web workflows. This leaves significant security and custodial risks in asset management.

### 3. Solution & Key Features

Glider leverages advanced browser automation combined with an AI decision engine to fully automate deposits, trades, staking, NFT minting, cross‑chain transfers, and data extraction. By executing all front-end tasks automatically, users simply provide transaction signatures via their EOA wallet. This ensures complete non‑custodial asset management, secure user-approved actions, and seamless operation across any dApp.

### 4. Use Cases

Glider can execute a wide range of crypto actions—from processing vague instructions for asset management to automating yield farming, portfolio rebalancing, arbitrage, NFT operations, and cross‑chain liquidity management. Whether you’re a beginner or an expert, Glider makes complex decentralized finance workflows accessible and efficient.

## Technical Detail

![architecture](./nodejs/app/public/architecture.png)

When a user starts a task, our AI Agent launches inside a Trusted Execution Environment (TEE) to ensure secure execution. The agent controls a headless browser using the Chrome DevTools Protocol (CDP) over WebSocket, powered by our browser automation module.

As the browser runs, it captures key vision data—such as screenshots and DOM elements—which is then sent to OpenAI for analysis. Based on the AI’s output, the agent determines the next action, whether it’s clicking a button, typing text, or navigating to another page, and executes it in real time.

Meanwhile, a Headless Web3 Provider is injected into the browser. This simulates a typical window.ethereum interface found in dApps. Any signing or transaction requests are intercepted and securely forwarded to the user's real wallet—ensuring that your private key is never exposed and always stays under your control.

Every prompt, decision, and result can be securely stored in our Recall Storage Network, enabling users to manage, import, and share reusable knowledge modules (like workflows and prompts). This opens up the possibility for on-chain transparent knowledge sharing, enhanced with TEE attestation to ensure authenticity, security, and trust across agents and users.

## Reference

### Autonome

Our AI Agent interacts with decentralized apps (dApps) through a headless browser, similar to Claude’s computer use or OpenAI’s operator. It features a wallet relayer—like WalletConnect—allowing users to inject their own wallets securely into the agent. The agent is deployed on Autonome and supports both local and cloud-hosted browsers, with inputs for logging and wallet request relayer paths.

We also enable knowledge sharing with executed results, allowing agents to learn and share outcomes. A Trusted Execution Environment (TEE) is crucial for this, ensuring that all shared knowledge is verifiable and securely generated.

- Framework: dbrowser012
- Deployed Agent: dbu-qtiadr

### Recall Network

Our AI Agent goes through a thinking process—understanding prompts, analyzing the browser, and deciding the next action. This thinking cycle contains valuable insights. We use Recall Network to store these thought processes, making them accessible and reusable by other users. This enables collaborative learning and improves agent performance over time.

In our workflow builder, we’ve also implemented a feature to fetch data from Recall Network and automatically create new Task nodes, allowing users to build on past knowledge and accelerate agent development.

Created bucket:
https://portal.recall.network/buckets/0xFF0000000000000000000000000000000000019B
