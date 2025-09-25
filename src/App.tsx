import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';

// 솔라나 라이브러리 import
import { Connection, PublicKey, Transaction, Commitment } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction 
} from '@solana/spl-token';

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

  // SNAX 토큰 잔액 조회 (수정된 버전)
  const getSnaxBalance = useCallback(async (address: string) => {
    try {
      console.log('[DEBUG] getSnaxBalance 호출. 주소:', address);
      
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');
      const ownerPublicKey = new PublicKey(address);
      
      // Associated Token Account 주소 계산
      const tokenAccountAddress = await getAssociatedTokenAddress(
        mintPublicKey, 
        ownerPublicKey,
        false // allowOwnerOffCurve - false가 기본값
      );
      
      console.log('[DEBUG] 토큰 계정 주소 (Associated):', tokenAccountAddress.toString());
      console.log('[DEBUG] 민트 주소:', mintPublicKey.toString());
      
      // 토큰 계정 정보 조회 시도
      const accountInfo = await connection.getAccountInfo(tokenAccountAddress, commitment);
      
      if (accountInfo === null) {
        console.log('[DEBUG] Associated 토큰 계정을 찾을 수 없습니다. 다른 토큰 계정 확인 중...');
        
        // 모든 토큰 계정 조회 (Associated가 아닌 계정도 포함)
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          ownerPublicKey,
          { mint: mintPublicKey },
          commitment
        );
        
        console.log('[DEBUG] 찾은 토큰 계정 수:', tokenAccounts.value.length);
        
        if (tokenAccounts.value.length > 0) {
          // 첫 번째 토큰 계정의 잔액 사용
          const tokenAccount = tokenAccounts.value[0];
          const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
          console.log('[DEBUG] SNAX 잔액 (대체 계정):', balance);
          console.log('[DEBUG] 실제 토큰 계정 주소:', tokenAccount.pubkey.toString());
          console.log('[DEBUG] Decimals:', tokenAccount.account.data.parsed.info.tokenAmount.decimals);
          setSnaxBalance(balance || 0);
          return balance || 0;
        } else {
          console.log('[DEBUG] SNAX 토큰 계정이 전혀 없습니다.');
          setSnaxBalance(0);
          return 0;
        }
      }
      
      // Associated Token Account가 존재하는 경우
      try {
        const balance = await connection.getTokenAccountBalance(tokenAccountAddress, commitment);
        console.log('[DEBUG] SNAX 잔액 (Associated):', balance.value.uiAmount);
        console.log('[DEBUG] Raw amount:', balance.value.amount);
        console.log('[DEBUG] Decimals:', balance.value.decimals);
        setSnaxBalance(balance.value.uiAmount || 0);
        return balance.value.uiAmount || 0;
      } catch (error) {
        console.error('[ERROR] 토큰 잔액 조회 실패:', error);
        setSnaxBalance(0);
        return 0;
      }
    } catch (error) {
      console.error('[ERROR] getSnaxBalance 에러:', error);
      setSnaxBalance(0);
      return 0;
    }
  }, [connection, commitment]);

  // SOL 잔액 조회
  const getSolBalance = useCallback(async (address: string) => {
    try {
      console.log('[DEBUG] getSolBalance 호출. 주소:', address);
      const balance = await connection.getBalance(new PublicKey(address), commitment);
      console.log('[DEBUG] SOL 잔액 조회 성공:', balance / 1e9);
      setSolBalance(balance / 1e9);
    } catch (error) {
      console.error('[ERROR] SOL 잔액 조회 실패:', error);
    }
  }, [connection, commitment]);

  // SNAX 토큰 전송 함수 (수정된 버전)
  const sendSnaxTokens = useCallback(async (amount: number, recipientAddress: string) => {
    if (!wallet || !walletAddress || !wallet.signAndSendTransaction) {
      alert('지갑이 연결되어 있지 않거나, 전송 기능을 지원하지 않습니다.');
      return;
    }
    
    // 수신자 주소 유효성 검사
    try {
      new PublicKey(recipientAddress);
    } catch (error) {
      alert('유효하지 않은 수신자 주소입니다.');
      return;
    }
    
    setIsLoading(true);
    setTransferStatus('⏳ 트랜잭션 생성 중...');
    
    console.log('[DEBUG] sendSnaxTokens 시작');
    console.log('[DEBUG] 전송량:', amount, 'SNAX');
    console.log('[DEBUG] 수신자:', recipientAddress);
    console.log('[DEBUG] 현재 SNAX 잔액:', snaxBalance);

    try {
      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');

      // 실제 보유한 토큰 계정 찾기
      const senderTokenAccounts = await connection.getParsedTokenAccountsByOwner(
        senderPublicKey,
        { mint: mintPublicKey },
        commitment
      );
      
      if (senderTokenAccounts.value.length === 0) {
        alert('SNAX 토큰 계정을 찾을 수 없습니다. 토큰을 보유하고 있는지 확인해주세요.');
        setIsLoading(false);
        setTransferStatus('');
        return;
      }
      
      // 실제 토큰 계정 주소 (Associated가 아닐 수 있음)
      const actualSenderTokenAccount = senderTokenAccounts.value[0].pubkey;
      const actualBalance = senderTokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      
      console.log('[DEBUG] 실제 보내는 사람 토큰 계정:', actualSenderTokenAccount.toString());
      console.log('[DEBUG] 실제 잔액:', actualBalance);
      
      // 잔액 체크
      if (actualBalance < amount) {
        alert(`SNAX 잔액이 부족합니다. 현재 잔액: ${actualBalance} SNAX`);
        setIsLoading(false);
        setTransferStatus('');
        return;
      }
      
      // 받는 사람의 Associated Token Account 주소
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(
        mintPublicKey, 
        recipientPublicKey,
        false
      );
      
      console.log('[DEBUG] 받는 사람 토큰 계정 (Associated):', recipientTokenAccountAddress.toString());

      // 토큰 양 계산 (decimals 확인)
      const decimals = senderTokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals;
      const transferAmount = amount * Math.pow(10, decimals);
      console.log('[DEBUG] Decimals:', decimals);
      console.log('[DEBUG] 전송할 토큰 양 (raw):', transferAmount);
      
      setTransferStatus('⏳ 트랜잭션 생성 중...');
      
      // 1. 받는 사람의 토큰 계정이 없는 경우, ATA 생성 트랜잭션 먼저 전송
      const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccountAddress, commitment);
      
      if (recipientAccountInfo === null) {
        console.log('[DEBUG] 받는 사람 토큰 계정이 없어 ATA 생성 트랜잭션을 전송합니다.');
        const latestBlockhash = await connection.getLatestBlockhash(commitment);
        
        const createAtaTransaction = new Transaction({
          recentBlockhash: latestBlockhash.blockhash,
          feePayer: senderPublicKey,
        }).add(
          createAssociatedTokenAccountInstruction(
            senderPublicKey,
            recipientTokenAccountAddress,
            recipientPublicKey,
            mintPublicKey
          )
        );
        
        console.log('[DEBUG] ATA 생성 트랜잭션 객체:', createAtaTransaction); 
        
        setTransferStatus('✍️ 지갑 서명을 기다리는 중 (ATA 생성)...');
        const { signature: createAtaSignature } = await wallet.signAndSendTransaction(createAtaTransaction);
        
        setTransferStatus('🔗 ATA 생성 트랜잭션 확인 중...');
        await connection.confirmTransaction({
          signature: createAtaSignature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, commitment);
        console.log('[DEBUG] ATA 생성 트랜잭션 확인 완료:', createAtaSignature);
      } else {
        console.log('[DEBUG] 받는 사람 토큰 계정이 이미 존재합니다.');
      }
      
      // 2. 토큰 전송 트랜잭션 전송
      console.log('[DEBUG] 토큰 전송 트랜잭션을 생성합니다.');
      const latestBlockhash = await connection.getLatestBlockhash(commitment);

      const transferTransaction = new Transaction({
        recentBlockhash: latestBlockhash.blockhash,
        feePayer: senderPublicKey,
      }).add(
        createTransferInstruction(
          actualSenderTokenAccount,
          recipientTokenAccountAddress,
          senderPublicKey,
          transferAmount
        )
      );

      console.log('[DEBUG] 최종 토큰 전송 트랜잭션 객체:', transferTransaction); 
      
      setTransferStatus('✍️ 지갑 서명을 기다리는 중 (토큰 전송)...');
      console.log('[DEBUG] 지갑 서명 요청');
      
      const { signature } = await wallet.signAndSendTransaction(transferTransaction);
      console.log('[DEBUG] 트랜잭션 서명:', signature);
      
      setTransferStatus('🔗 트랜잭션 확인 중...');

      // 트랜잭션 확인
      await connection.confirmTransaction({
        signature: signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, commitment);
      
      console.log('[DEBUG] 트랜잭션 확인 완료:', signature);

      // 성공 처리
      alert(`🚀 SNAX 토큰 전송 성공!\n트랜잭션 ID: ${signature}`);
      setTransferStatus(`✅ 전송 완료!`);
      
      // 잔액 업데이트 (2초 후)
      setTimeout(() => {
        getSnaxBalance(walletAddress);
        console.log('[DEBUG] 잔액 업데이트 요청');
      }, 2000);

    } catch (error: any) {
      console.error('[ERROR] SNAX 토큰 전송 실패:', error);
      
      let errorMessage = '전송 실패';
      
      if (error.message?.includes('User rejected')) {
        errorMessage = '사용자가 트랜잭션을 거부했습니다.';
      } else if (error.message?.includes('insufficient lamports')) {
        errorMessage = 'SOL 잔액이 부족합니다. 가스비를 위한 SOL이 필요합니다.';
      } else if (error.message?.includes('0x1') || error.message?.includes('insufficient funds')) {
        errorMessage = 'SNAX 토큰 잔액이 부족합니다.';
      } else if (error.message?.includes('Invalid')) {
        errorMessage = '잘못된 주소 또는 계정입니다.';
      } else {
        errorMessage = `전송 실패: ${error.message || '알 수 없는 에러'}`;
      }
      
      setTransferStatus(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, walletAddress, connection, snaxBalance, getSnaxBalance, commitment]);

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