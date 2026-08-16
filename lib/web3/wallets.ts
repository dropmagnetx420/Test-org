/**
 * EIP-6963 wallet discovery. Every modern EVM wallet (MetaMask, Rabby, Trust,
 * Bitget, Coinbase, Robinhood, …) announces an injected provider under this
 * standard, so we can list them all instead of fighting over a single
 * `window.ethereum`. Falls back to the legacy injected provider when a wallet
 * predates EIP-6963.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DiscoveredWallet {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

/**
 * Ask every injected wallet to announce itself and collect the replies for a
 * short window. Resolves with a de-duplicated list (keyed by rdns).
 */
export function discoverWallets(timeoutMs = 350): Promise<DiscoveredWallet[]> {
  if (typeof window === "undefined") return Promise.resolve([]);

  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredWallet>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<DiscoveredWallet>).detail;
      if (detail?.info?.rdns && detail.provider) found.set(detail.info.rdns, detail);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);

      if (found.size === 0) {
        const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
        if (injected) {
          found.set("injected", {
            info: { uuid: "injected", name: "Browser wallet", icon: "", rdns: "injected" },
            provider: injected,
          });
        }
      }

      resolve([...found.values()]);
    }, timeoutMs);
  });
}
