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
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Phantom Wallet 타입 정의
interface PhantomWallet {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  isConnected?: boolean;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  [key: string]: any;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
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

  // SNAX 잔액 조회
  const getSnaxBalance = useCallback(async (address: string) => {
    try {
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');
      const ownerPublicKey = new PublicKey(address);

      const tokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, ownerPublicKey);
      const accountInfo = await connection.getAccountInfo(tokenAccountAddress, commitment);

      if (!accountInfo) {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          ownerPublicKey,
          { mint: mintPublicKey },
          commitment
        );
        if (tokenAccounts.value.length > 0) {
          const tokenAccount = tokenAccounts.value[0];
          const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
          setSnaxBalance(balance || 0);
          return balance || 0;
        } else {
          setSnaxBalance(0);
          return 0;
        }
      }

      const balance = await connection.getTokenAccountBalance(tokenAccountAddress, commitment);
      setSnaxBalance(balance.value.uiAmount || 0);
      return balance.value.uiAmount || 0;
    } catch (error) {
      console.error('[ERROR] getSnaxBalance 에러:', error);
      setSnaxBalance(0);
      return 0;
    }
  }, [connection, commitment]);

  // SOL 잔액 조회
  const getSolBalance = useCallback(async (address: string) => {
    try {
      const balance = await connection.getBalance(new PublicKey(address), commitment);
      setSolBalance(balance / 1e9);
    } catch (error) {
      console.error('[ERROR] SOL 잔액 조회 실패:', error);
    }
  }, [connection, commitment]);

  // SNAX 전송
  const sendSnaxTokens = useCallback(async (amount: number, recipientAddress: string) => {
    if (!wallet || !walletAddress || !wallet.signTransaction) {
      alert('지갑이 연결되어 있지 않거나, 전송 기능을 지원하지 않습니다.');
      return;
    }
  
    try {
      new PublicKey(recipientAddress);
    } catch {
      alert('유효하지 않은 수신자 주소입니다.');
      return;
    }
  
    setIsLoading(true);
    setTransferStatus('⏳ 트랜잭션 준비 중...');
  
    try {
      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');
  
      // 보내는 사람 토큰 계정
      const senderTokenAccounts = await connection.getParsedTokenAccountsByOwner(
        senderPublicKey,
        { mint: mintPublicKey },
        commitment
      );
      if (senderTokenAccounts.value.length === 0) {
        alert('SNAX 토큰 계정을 찾을 수 없습니다.');
        setIsLoading(false);
        setTransferStatus('');
        return;
      }
      const actualSenderTokenAccount = senderTokenAccounts.value[0].pubkey;
      const actualBalance = senderTokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      const decimals = senderTokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals;
  
      if (actualBalance < amount) {
        alert(`SNAX 잔액이 부족합니다. 현재 잔액: ${actualBalance} SNAX`);
        setIsLoading(false);
        setTransferStatus('');
        return;
      }
  
      // 수신자 ATA 주소 (기본값 사용)
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientPublicKey
      );
  
      const transferAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
      const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccountAddress, commitment);
      const latestBlockhash = await connection.getLatestBlockhash(commitment);
  
      const tx = new Transaction({
        recentBlockhash: latestBlockhash.blockhash,
        feePayer: senderPublicKey,
      });
  
      // 수신자 계정이 없으면 생성
      if (!recipientAccountInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            senderPublicKey,
            recipientTokenAccountAddress,
            recipientPublicKey,
            mintPublicKey
          )
        );
      }
  
      // 토큰 전송
      tx.add(
        createTransferInstruction(
          actualSenderTokenAccount,
          recipientTokenAccountAddress,
          senderPublicKey,
          transferAmount
        )
      );
  
      setTransferStatus('✍️ 지갑 서명 대기중...');
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
  
      setTransferStatus('🔗 트랜잭션 확인 중...');
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        commitment
      );
  
      alert(`🚀 SNAX 전송 성공! 트랜잭션: ${sig}`);
      setTransferStatus('✅ 전송 완료!');
      setTimeout(() => getSnaxBalance(walletAddress), 2000);
  
    } catch (error: any) {
      console.error('[ERROR] SNAX 토큰 전송 실패:', error);
      let errorMessage = `전송 실패: ${error.message || '알 수 없는 에러'}`;
      if (error.message?.includes('User rejected')) errorMessage = '사용자가 트랜잭션을 거부했습니다.';
      if (error.message?.includes('insufficient lamports')) errorMessage = 'SOL 잔액이 부족합니다. 가스비가 필요합니다.';
      setTransferStatus(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, walletAddress, connection, getSnaxBalance, commitment]);

  // SOL 가격 조회
  const getSolPrice = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await res.json();
      setSolPrice(data.solana.usd);
    } catch (error) {
      console.error('SOL 가격 조회 실패:', error);
    }
  }, []);

  // 지갑 연결
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
        alert('✅ Devnet 연결 성공!');
      } catch (error) {
        console.error('지갑 연결 실패:', error);
        alert('지갑 연결에 실패했습니다.');
      }
    } else {
      alert('Phantom Wallet을 설치해주세요.');
    }
  }, [getSolBalance, getSnaxBalance, getSolPrice]);

  useEffect(() => {
    const autoConnect = async () => {
      if (window.solana?.isPhantom) {
        setWallet(window.solana);
        try {
          const response = await window.solana.connect({ onlyIfTrusted: true });
          const address = response.publicKey.toString();
          setWalletAddress(address);
          getSolBalance(address);
          getSnaxBalance(address);
          getSolPrice();
        } catch {
          console.log('자동 연결 실패');
        }
      }
    };
    autoConnect();
  }, [getSolBalance, getSnaxBalance, getSolPrice]);

  // 테스트 SOL 요청
  const requestTestSol = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const latestBlockhash = await connection.getLatestBlockhash(commitment);
      const signature = await connection.requestAirdrop(new PublicKey(walletAddress), 1e9);
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, commitment);
      alert('테스트 SOL 요청 성공!');
      setTimeout(() => getSolBalance(walletAddress), 3000);
    } catch (error) {
      console.error(error);
      alert('테스트 SOL 요청 실패');
    }
  }, [walletAddress, connection, getSolBalance, commitment]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Solana Test App</h1>
        <p>Phantom Wallet을 연결하고 SNAX 토큰을 전송해보세요!</p>

        {!walletAddress ? (
          <WalletConnection onConnect={connectWallet} isLoading={isLoading} />
        ) : (
          <WalletInfo
            walletAddress={walletAddress}
            solBalance={solBalance}
            solPrice={{ usd: solPrice, krw: solPrice * 1300 }}
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
