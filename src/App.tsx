import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // 수정: useRef import
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';

import { Connection, PublicKey, Transaction, Commitment } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getMint,
  Account
} from '@solana/spl-token';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// ... (PhantomWallet, TokenAccount 인터페이스 등은 이전과 동일)
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
  const [snaxDecimals, setSnaxDecimals] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transferStatus, setTransferStatus] = useState<string>('');

  // 수정: 중복 실행을 막기 위한 ref 잠금 변수 생성
  const isSending = useRef(false);

  const connection = useMemo(() => new Connection('https://api.devnet.solana.com', 'confirmed'), []);
  const commitment: Commitment = 'confirmed';
  const SNAX_MINT = 'ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV';

  const getSolBalance = useCallback(async (address: string) => {
    try {
      const balance = await connection.getBalance(new PublicKey(address), commitment);
      setSolBalance(balance / 1e9);
    } catch (error) {
      console.error('[ERROR] SOL 잔액 조회 실패:', error);
    }
  }, [connection, commitment]);

  const getSnaxBalance = useCallback(async (address: string, decimals: number | null) => {
    if (decimals === null) {
        setSnaxBalance(0);
        return 0;
    }
    try {
      const ownerPublicKey = new PublicKey(address);
      const mintPublicKey = new PublicKey(SNAX_MINT);
      const tokenAccount = await getAssociatedTokenAddress(
        mintPublicKey, 
        ownerPublicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const accountInfo = await getAccount(connection, tokenAccount, commitment, TOKEN_2022_PROGRAM_ID) as TokenAccount;
      
      const balance = Number(accountInfo.amount) / (10 ** decimals);
      setSnaxBalance(balance);
      return balance;
    } catch (error) {
      console.log('[INFO] SNAX 토큰 계정이 없어 잔액을 0으로 설정합니다.');
      setSnaxBalance(0);
      return 0;
    }
  }, [connection, commitment]);

  const sendSnaxTokens = useCallback(async (amount: number, recipientAddress: string) => {
    // 수정: isLoading 대신 isSending.current를 확인하여 즉시 잠금
    if (isSending.current) return;

    if (!wallet || !walletAddress || !wallet.signTransaction) {
      alert('지갑이 연결되어 있지 않거나 전송 기능을 지원하지 않습니다.');
      return;
    }
    if (snaxDecimals === null) {
        alert('토큰 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    // 수정: 잠금 시작
    isSending.current = true; 
    setIsLoading(true);
    setTransferStatus('🚀 트랜잭션 준비중...');

    try {
      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      const mintPublicKey = new PublicKey(SNAX_MINT);
      const decimals = snaxDecimals;

      const senderTokenAccount = await getAssociatedTokenAddress(mintPublicKey, senderPublicKey, false, TOKEN_2022_PROGRAM_ID);
      const recipientTokenAccount = await getAssociatedTokenAddress(mintPublicKey, recipientPublicKey, false, TOKEN_2022_PROGRAM_ID);

      const senderAccountInfo = await getAccount(connection, senderTokenAccount, commitment, TOKEN_2022_PROGRAM_ID) as TokenAccount;
      const actualBalance = Number(senderAccountInfo.amount) / (10 ** decimals);

      if (actualBalance < amount) {
        alert(`SNAX 잔액 부족: 현재 ${actualBalance} SNAX`);
        setTransferStatus('❌ 잔액 부족');
        setIsLoading(false);
        isSending.current = false; // 수정: 실패 시 잠금 해제
        return;
      }

      const tx = new Transaction();
      const recipientInfo = await connection.getAccountInfo(recipientTokenAccount);

      if (!recipientInfo) {
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
      setTimeout(() => getSnaxBalance(walletAddress, decimals), 2000);

    } catch (error: any) {
      console.error('[ERROR] SNAX 전송 실패:', error);
      let msg = error.message || '알 수 없는 오류';
      if (msg.includes('User rejected')) msg = '사용자가 트랜잭션을 거부했습니다.';
      setTransferStatus(`❌ ${msg}`);
      alert(msg);
    } finally {
      // 수정: 작업이 끝나면 반드시 잠금 해제
      isSending.current = false;
      setIsLoading(false);
    }
  }, [wallet, walletAddress, connection, getSnaxBalance, commitment, snaxDecimals]); // 수정: isLoading 의존성 제거

  // ... (getSolPrice, connectWallet, useEffect, requestTestSol 등 나머지 코드는 동일)
  const getSolPrice = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await res.json();
      setSolPrice(data.solana.usd);
    } catch (error) {
      console.error('SOL 가격 조회 실패:', error);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (window.solana?.isPhantom) {
      try {
        const response = await window.solana.connect();
        const address = response.publicKey.toString();
        setWallet(window.solana);
        setWalletAddress(address);

        await getSolBalance(address);
        await getSolPrice();
        
        const mintPublicKey = new PublicKey(SNAX_MINT);
        const mintInfo = await getMint(connection, mintPublicKey, commitment, TOKEN_2022_PROGRAM_ID);
        setSnaxDecimals(mintInfo.decimals);
        
        await getSnaxBalance(address, mintInfo.decimals);

        alert('✅ Devnet 연결 성공!');
      } catch(err) {
        console.error("지갑 연결 실패:", err)
        alert('지갑 연결 실패');
      }
    } else {
      alert('Phantom Wallet 설치 필요');
    }
  }, [getSolBalance, getSnaxBalance, getSolPrice, connection, commitment]);

  useEffect(() => {
    const autoConnect = async () => {
      if (window.solana?.isPhantom) {
        setWallet(window.solana);
        try {
          const resp = await window.solana.connect({ onlyIfTrusted: true });
          const addr = resp.publicKey.toString();
          setWalletAddress(addr);

          getSolBalance(addr);
          getSolPrice();

          const mintPublicKey = new PublicKey(SNAX_MINT);
          const mintInfo = await getMint(connection, mintPublicKey, commitment, TOKEN_2022_PROGRAM_ID);
          setSnaxDecimals(mintInfo.decimals);
          await getSnaxBalance(addr, mintInfo.decimals);

        } catch {
          console.log('자동 연결 실패');
        }
      }
    };
    autoConnect();
  }, [getSolBalance, getSnaxBalance, getSolPrice, connection, commitment]);

  const requestTestSol = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const latestBlockhash = await connection.getLatestBlockhash(commitment);
      const sig = await connection.requestAirdrop(new PublicKey(walletAddress), 1e9);
      await connection.confirmTransaction({
        signature: sig,
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
            onRefreshSnaxBalance={() => getSnaxBalance(walletAddress, snaxDecimals)}
            transferStatus={transferStatus}
            isLoading={isLoading}
            onDisconnect={() => {
              wallet?.disconnect();
              setWallet(null);
              setWalletAddress('');
              setSolBalance(0);
              setSnaxBalance(0);
              setSnaxDecimals(null);
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