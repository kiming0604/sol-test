import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';

import { Connection, PublicKey, Transaction, Commitment } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID, // Use the Token 2022 Program ID
  getAccount,
  Account
} from '@solana/spl-token';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

interface PhantomWallet {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  [key: string]: any;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// Extend Account interface for token details
interface TokenAccount extends Account {
  amount: bigint;
  decimals: number;
}

function App() {
  const [wallet, setWallet] = useState<PhantomWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [solBalance, setSolBalance] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [snaxBalance, setSnaxBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transferStatus, setTransferStatus] = useState<string>('');

  const connection = useMemo(() => new Connection('https://api.devnet.solana.com', 'confirmed'), []);
  const commitment: Commitment = 'confirmed';
  const SNAX_MINT = 'ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV';

  // Fetch SOL balance
  const getSolBalance = useCallback(async (address: string) => {
    try {
      const balance = await connection.getBalance(new PublicKey(address), commitment);
      setSolBalance(balance / 1e9);
    } catch (error) {
      console.error('[ERROR] Failed to get SOL balance:', error);
    }
  }, [connection, commitment]);

  // Fetch SNAX (Token 2022) balance
  const getSnaxBalance = useCallback(async (address: string) => {
    try {
      const ownerPublicKey = new PublicKey(address);
      const mintPublicKey = new PublicKey(SNAX_MINT);
      
      // **MODIFIED**: Specify Token 2022 program ID
      const tokenAccount = await getAssociatedTokenAddress(
        mintPublicKey, 
        ownerPublicKey,
        false, // allowOwnerOffCurve
        TOKEN_2022_PROGRAM_ID 
      );

      // **MODIFIED**: Specify Token 2022 program ID
      const accountInfo = await getAccount(
        connection, 
        tokenAccount, 
        commitment, 
        TOKEN_2022_PROGRAM_ID
      ) as TokenAccount;

      const balance = Number(accountInfo.amount) / (10 ** accountInfo.decimals);
      setSnaxBalance(balance);
      return balance;
    } catch (error) {
      console.error('[ERROR] Failed to get SNAX balance:', error);
      setSnaxBalance(0);
      return 0;
    }
  }, [connection, commitment]);

  // Send SNAX (Token 2022) tokens
  const sendSnaxTokens = useCallback(async (amount: number, recipientAddress: string) => {
    if (!wallet || !walletAddress || !wallet.signTransaction) {
      alert('Wallet is not connected or does not support sending transactions.');
      return;
    }

    setIsLoading(true);
    setTransferStatus('🚀 Preparing transaction...');

    try {
      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      const mintPublicKey = new PublicKey(SNAX_MINT);

      // **MODIFIED**: Specify Token 2022 program ID for both sender and recipient
      const senderTokenAccount = await getAssociatedTokenAddress(mintPublicKey, senderPublicKey, false, TOKEN_2022_PROGRAM_ID);
      const recipientTokenAccount = await getAssociatedTokenAddress(mintPublicKey, recipientPublicKey, false, TOKEN_2022_PROGRAM_ID);
      
      // **MODIFIED**: Specify Token 2022 program ID to get account info
      const senderAccountInfo = await getAccount(connection, senderTokenAccount, commitment, TOKEN_2022_PROGRAM_ID) as TokenAccount;
      const decimals = senderAccountInfo.decimals;
      const actualBalance = Number(senderAccountInfo.amount) / (10 ** decimals);

      if (actualBalance < amount) {
        alert(`Insufficient SNAX balance. You have: ${actualBalance} SNAX`);
        setTransferStatus('❌ Insufficient balance.');
        return;
      }

      const tx = new Transaction();
      const recipientInfo = await connection.getAccountInfo(recipientTokenAccount);

      if (!recipientInfo) {
        // **MODIFIED**: Use TOKEN_2022_PROGRAM_ID for creating the associated token account
        tx.add(
          createAssociatedTokenAccountInstruction(
            senderPublicKey,
            recipientTokenAccount,
            recipientPublicKey,
            mintPublicKey,
            TOKEN_2022_PROGRAM_ID 
          )
        );
      }

      // **MODIFIED**: Use TOKEN_2022_PROGRAM_ID for the transfer instruction
      tx.add(
        createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          senderPublicKey,
          BigInt(Math.floor(amount * (10 ** decimals))),
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash(commitment);
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = senderPublicKey;

      setTransferStatus('✍️ Awaiting wallet signature...');
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());

      setTransferStatus('🔗 Confirming transaction...');
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        commitment
      );

      alert(`🚀 SNAX sent successfully! Transaction: ${sig}`);
      setTransferStatus('✅ Transfer complete!');
      setTimeout(() => getSnaxBalance(walletAddress), 2000);

    } catch (error: any) {
      console.error('[ERROR] Failed to send SNAX:', error);
      let msg = error.message || 'An unknown error occurred';
      if (msg.includes('User rejected')) msg = 'Transaction rejected by user.';
      setTransferStatus(`❌ ${msg}`);
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, walletAddress, connection, getSnaxBalance, commitment]);

  // Fetch SOL price from CoinGecko
  const getSolPrice = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await res.json();
      setSolPrice(data.solana.usd);
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
    }
  }, []);

  // Connect to Phantom wallet
  const connectWallet = useCallback(async () => {
    if (window.solana?.isPhantom) {
      try {
        const response = await window.solana.connect();
        const address = response.publicKey.toString();
        setWallet(window.solana);
        setWalletAddress(address);
        await getSolBalance(address);
        await getSnaxBalance(address);
        await getSolPrice();
        alert('✅ Devnet wallet connected successfully!');
      } catch {
        alert('Wallet connection failed.');
      }
    } else {
      alert('Phantom Wallet not found. Please install it.');
    }
  }, [getSolBalance, getSnaxBalance, getSolPrice]);

  // Auto-connect on page load if wallet is already trusted
  useEffect(() => {
    const autoConnect = async () => {
      if (window.solana?.isPhantom) {
        setWallet(window.solana);
        try {
          const resp = await window.solana.connect({ onlyIfTrusted: true });
          const addr = resp.publicKey.toString();
          setWalletAddress(addr);
          getSolBalance(addr);
          getSnaxBalance(addr);
          getSolPrice();
        } catch {
          console.log('Auto-connection failed.');
        }
      }
    };
    autoConnect();
  }, [getSolBalance, getSnaxBalance, getSolPrice]);

  // Request test SOL from airdrop
  const requestTestSol = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const latestBlockhash = await connection.getLatestBlockhash(commitment);
      const sig = await connection.requestAirdrop(new PublicKey(walletAddress), 1e9); // 1 SOL
      await connection.confirmTransaction({
        signature: sig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, commitment);
      alert('Test SOL airdrop successful!');
      setTimeout(() => getSolBalance(walletAddress), 3000);
    } catch (error) {
      console.error(error);
      alert('Failed to request test SOL.');
    }
  }, [walletAddress, connection, getSolBalance, commitment]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Solana Test App</h1>
        <p>Connect your Phantom Wallet to send SNAX (Token 2022) tokens!</p>

        {!walletAddress ? (
          <WalletConnection onConnect={connectWallet} isLoading={isLoading} />
        ) : (
          <WalletInfo
            walletAddress={walletAddress}
            solBalance={solBalance}
            solPrice={{ usd: solPrice, krw: solPrice * 1300 }} // Example KRW conversion
            snaxBalance={snaxBalance}
            onSendSnaxTokens={sendSnaxTokens}
            onRefreshSnaxBalance={() => getSnaxBalance(walletAddress)}
            transferStatus={transferStatus}
            isLoading={isLoading}
            onDisconnect={() => {
              wallet?.disconnect();
              setWallet(null);
              setWalletAddress('');
              setSolBalance(0);
              setSnaxBalance(0);
              setTransferStatus('');
            }}
            onRequestTestSol={requestTestSol}
            onIncrement={() => {}}
            onDecrement={() => {}}
            onReset={() => {}}
            counterValue={0}
            contractAddress={COUNTER_PROGRAM_ID}
          />
        )}
      </header>
    </div>
  );
}

export default App;