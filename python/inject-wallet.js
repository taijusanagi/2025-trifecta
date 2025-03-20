console.log("🚀 Injecting Headless Web3 Provider...");

(async () => {
  const ethers = window.ethers
  const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const wallet = new ethers.Wallet(privateKey);

  function createCustomEthereumProvider(options = {}) {
    // Default RPC URL if not provided
    const rpcUrl = options.rpcUrl || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';
    // Default chainId for Ethereum mainnet
    const chainId = options.chainId || '0x1';
    // Optional private key for signing transactions

    // Base provider object
    const provider = {
      isMetaMask: true,
      isCustomProvider: true,
      // Track connected status
      _isConnected: false,
      // Store accounts
      _accounts: options.accounts || [],
      // Store request handlers
      _handlers: {},
      
      // Network-related methods
      chainId,
      networkVersion: parseInt(chainId, 16).toString(),
      
      // Required method for EIP-1193 compliance
      async request({ method, params }) {
        console.log("method", method)
        console.log("method", params)

        switch (method) {
          case 'eth_chainId':
            return chainId;
            
          case 'eth_accounts':
          case 'eth_requestAccounts':
            if (this._isConnected && this._accounts.length > 0) {
              return [...this._accounts];
            }
            // If not connected, return empty array for eth_accounts
            // or connect for eth_requestAccounts
            if (method === 'eth_accounts') {
              return [];
            } else {
              await this.connect();
              return [...this._accounts];
            }
            
          case 'eth_getBalance':
            // Implement or forward to actual provider
            return this._sendToRpc(method, params);
            
          case 'eth_sendTransaction':
            if (!privateKey) {
              throw new Error('Private key required for sending transactions');
            }
            // In a real implementation, you would sign the transaction with the private key
            // and then broadcast it to the network
            return this._sendToRpc('eth_sendRawTransaction', [/* signed tx */]);
            
          case "personal_sign":
            if (!params || params.length < 2) {
              throw new Error("Invalid parameters for eth_personalSign");
            }
            const message = params[0];
            const signedMessage = await wallet.signMessage(ethers.getBytes(message));
            return signedMessage;

          default:
            // Forward other requests to RPC
            return this._sendToRpc(method, params);
        }
      },
      
      // Connect method
      async connect() {
        // Simulating connection process
        if (this._accounts.length === 0 && options.defaultAccount) {
          this._accounts.push(options.defaultAccount);
        }
        
        this._isConnected = true;
        this._emit('connect', { chainId });
        return this._accounts;
      },
      
      // Disconnect method
      async disconnect() {
        this._isConnected = false;
        this._emit('disconnect');
      },
      
      // Send RPC request to provider
      async _sendToRpc(method, params) {
        try {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: new Date().getTime(),
              method,
              params,
            }),
          });
          
          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error.message || 'RPC Error');
          }
          
          return data.result;
        } catch (error) {
          console.error('RPC request failed:', error);
          throw error;
        }
      },
      
      // Event handling
      on(eventName, handler) {
        if (!this._handlers[eventName]) {
          this._handlers[eventName] = [];
        }
        this._handlers[eventName].push(handler);
        return this;
      },
      
      removeListener(eventName, handler) {
        if (this._handlers[eventName]) {
          this._handlers[eventName] = this._handlers[eventName].filter(h => h !== handler);
        }
        return this;
      },
      
      _emit(eventName, data) {
        if (this._handlers[eventName]) {
          this._handlers[eventName].forEach(handler => handler(data));
        }
      }
    };
    
    return provider;
  }
  
  // Create EIP-6963 compliant provider info object
  function createEIP6963ProviderInfo(provider, options = {}) {
    return {
      uuid: options.uuid || crypto.randomUUID(), // Generate unique ID for the provider
      name: options.name || "Custom Headless Provider",
      icon: options.icon || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCA4NC44NSA4NC44NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJtNDIuNDMgMGMtMjMuNDMgMC00Mi40MyAxOS0yMi40MyA0Mi40M3MtMTkgNDIuNDMgNDIuNDMgNDIuNDMgNDIuNDMtMTkgNDIuNDMtNDIuNDNjMC0yMy40My0xOS00Mi40My00Mi40My00Mi40M3oiIGZpbGw9IiM1MjhiZDIiLz48L3N2Zz4=",
      rdns: options.rdns || "io.headless.eip6963"
    };
  }
  
  // Update window.ethereum with the custom provider
  function setupProviders(options = {}) {
    // Create the provider
    const customProvider = createCustomEthereumProvider(options);
    
    // Preserve the original provider if it exists
    if (window.ethereum) {
      customProvider._originalProvider = window.ethereum;
    }
    
    // Override window.ethereum - traditional way, kept for compatibility
    window.ethereum = customProvider;
    
    // Add a method to restore the original provider
    window.ethereum.restoreOriginalProvider = function() {
      if (this._originalProvider) {
        window.ethereum = this._originalProvider;
        return true;
      }
      return false;
    };
    
    // Set up EIP-6963 provider for modern dapps
    const providerInfo = createEIP6963ProviderInfo(customProvider, {
      name: options.providerName || "Headless Web3 Provider",
      rdns: options.providerRdns || "io.headless.eip6963"
    });
    
    // Create the provider detail object according to EIP-6963
    const providerDetail = {
      info: providerInfo,
      provider: customProvider
    };
    
    // Store EIP-6963 announced providers
    window.ethereum6963Providers = window.ethereum6963Providers || [];
    window.ethereum6963Providers.push(providerDetail);
    
    // Announce this provider according to EIP-6963
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: providerDetail
    }));
    
    // Set up a listener for future provider requests
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: providerDetail
      }));
    });
    
    return {
      provider: customProvider,
      providerInfo
    };
  }
  
  // Initialize the provider with configuration
  const { provider, providerInfo } = setupProviders({
    rpcUrl: 'https://eth.llamarpc.com', // Replace with your Infura key
    chainId: '0x1', // Mainnet
    defaultAccount: wallet.address,
    accounts: [wallet.address],
    providerName: "Headless Web3 Provider",
    providerRdns: "io.headless.provider"
  });
  
  // Signal that the provider has been initialized
  console.log('EIP-6963 Ethereum provider injected:', provider);
  console.log('Provider info:', providerInfo);

})();