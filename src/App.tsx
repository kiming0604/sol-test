import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';

// 솔라나 라이브러리 import
import { Connection, PublicKey, Transaction, Commitment, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';


// Buffer polyfill
import { Buffer } from 'buffer';
window.Buffer = Buffer;


// Phantom Wallet 타입 정의
interface PhantomWallet {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  isConnected?: boolean;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
  [key: string]: any;
}

// Window 타입 확장
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

  // SNAX 토큰 잔액 조회
  const getSnaxBalance = useCallback(async (address: string) => {
    console.log('[DEBUG] getSnaxBalance 호출. 주소:', address);
    try {
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');
      const ownerPublicKey = new PublicKey(address);
      const tokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, ownerPublicKey);
      
      console.log('[DEBUG] 토큰 계정 주소:', tokenAccountAddress.toBase58());
      
      const accountInfo = await connection.getAccountInfo(tokenAccountAddress, commitment);
      if (accountInfo === null) {
        setSnaxBalance(0);
        console.log('[DEBUG] SNAX 토큰 계정을 찾을 수 없습니다. 잔액: 0');
        return;
      }

      const balance = await connection.getTokenAccountBalance(tokenAccountAddress, commitment);
      setSnaxBalance(balance.value.uiAmount || 0);
      console.log(`[DEBUG] SNAX 토큰 잔액 조회 성공: ${balance.value.uiAmount}`);
    } catch (error) {
      setSnaxBalance(0);
      console.error('[ERROR] SNAX 토큰 잔액 조회 실패:', error);
      console.log('SNAX 토큰 계정을 찾을 수 없거나 잔액 조회에 실패했습니다.');
    }
  }, [connection, commitment]);

  // SOL 잔액 조회
  const getSolBalance = useCallback(async (address: string) => {
    console.log('[DEBUG] getSolBalance 호출. 주소:', address);
    try {
      const balance = await connection.getBalance(new PublicKey(address), commitment);
      setSolBalance(balance / 1e9);
      console.log(`[DEBUG] SOL 잔액 조회 성공: ${balance / 1e9}`);
    } catch (error) {
      console.error('[ERROR] SOL 잔액 조회 실패:', error);
    }
  }, [connection, commitment]);

  // SNAX 토큰 전송 함수
  const sendSnaxTokens = useCallback(async (amount: number, recipientAddress: string) => {
    if (!wallet || !walletAddress || !wallet.signAndSendTransaction) {
      alert('지갑이 연결되어 있지 않거나, 전송 기능을 지원하지 않습니다.');
      return;
    }
    
    setIsLoading(true);
    setTransferStatus('⏳ 트랜잭션 생성 중...');
    console.log('[DEBUG] sendSnaxTokens 시작');

    try {
      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');

      const senderTokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, senderPublicKey);
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, recipientPublicKey);
      console.log(`[DEBUG] 보내는 사람 토큰 계정: ${senderTokenAccountAddress.toBase58()}`);
      console.log(`[DEBUG] 받는 사람 토큰 계정: ${recipientTokenAccountAddress.toBase58()}`);

      const transferAmount = amount * Math.pow(10, 6);
      
      const latestBlockhash = await connection.getLatestBlockhash(commitment);
      
      const transaction = new Transaction({
        recentBlockhash: latestBlockhash.blockhash,
        feePayer: senderPublicKey,
      });

      // ✅ 보내는 사람의 토큰 계정 확인 및 생성
      const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccountAddress, commitment);
      if (senderTokenAccountInfo === null) {
        console.log('[DEBUG] 보내는 사람 토큰 계정이 없어 생성합니다.');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderPublicKey,
            senderTokenAccountAddress,
            senderPublicKey,
            mintPublicKey,
            TOKEN_PROGRAM_ID
          )
        );
      }

      // ✅ 받는 사람의 토큰 계정 확인 및 생성
      const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccountAddress, commitment);
      if (recipientTokenAccountInfo === null) {
        console.log('[DEBUG] 받는 사람 토큰 계정이 없어 생성합니다.');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderPublicKey,
            recipientTokenAccountAddress,
            recipientPublicKey,
            mintPublicKey,
            TOKEN_PROGRAM_ID
          )
        );
      }
      
      transaction.add(
        createTransferInstruction(
          senderTokenAccountAddress,
          recipientTokenAccountAddress,
          senderPublicKey,
          transferAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      setTransferStatus('✍️ 지갑 서명을 기다리는 중...');
      console.log('[DEBUG] 지갑 서명 요청');

      const { signature } = await wallet.signAndSendTransaction(transaction);
      setTransferStatus('🔗 트랜잭션 확인 중...');
      console.log(`[DEBUG] 트랜잭션 서명: ${signature}`);

      await connection.confirmTransaction({
        signature: signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, commitment);

      alert(`🚀 SNAX 토큰 전송 성공!`);
      setTransferStatus(`✅ 전송 완료!`);
      console.log('[DEBUG] 트랜잭션 성공적으로 확정됨.');

      setTimeout(() => getSnaxBalance(walletAddress), 2000);

    } catch (error: any) {
      console.error('[ERROR] SNAX 토큰 전송 실패:', error);
      let errorMessage = `전송 실패: ${error.message || '알 수 없는 에러'}`;
      if (error.message?.includes('User rejected')) {
        errorMessage = '사용자가 트랜잭션을 거부했습니다.';
      }
      setTransferStatus(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, walletAddress, connection, getSnaxBalance, commitment]);

  // SOL 가격 조회
  const getSolPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await response.json();
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
        
        alert('✅ Devnet으로 연결되었습니다!');
      } catch (error) {
        console.error('지갑 연결 실패:', error);
        alert('지갑 연결에 실패했습니다.');
      }
    } else {
      alert('Phantom Wallet을 설치해주세요.');
    }
  }, [getSolBalance, getSnaxBalance, getSolPrice]);

  // 자동 연결
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
        } catch (error) {
          console.log("자동 연결 실패: 사용자의 승인이 필요합니다.");
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
      const signature = await connection.requestAirdrop(new PublicKey(walletAddress), 1e9); // 1 SOL
      await connection.confirmTransaction({
        signature: signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, commitment);
      alert('테스트 SOL 요청이 성공했습니다! 잠시 후 잔액이 업데이트됩니다.');
      setTimeout(() => getSolBalance(walletAddress), 5000);
    } catch (error) {
      alert('테스트 SOL 요청에 실패했습니다.');
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