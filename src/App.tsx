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
  TOKEN_PROGRAM_ID
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
      console.debug('[DEBUG] getSnaxBalance 호출. 주소:', address);
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');
      const ownerPublicKey = new PublicKey(address);

      const tokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, ownerPublicKey, false);
      console.debug('[DEBUG] 계산된 Associated 주소:', tokenAccountAddress.toString());

      const accountInfo = await connection.getAccountInfo(tokenAccountAddress, commitment);
      if (accountInfo === null) {
        console.debug('[DEBUG] Associated 토큰 계정 없음 -> 모든 토큰 계정 조회');
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, { mint: mintPublicKey }, commitment);
        if (tokenAccounts.value.length > 0) {
          const tokenAccount = tokenAccounts.value[0];
          const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
          setSnaxBalance(balance || 0);
          console.debug('[DEBUG] 대체 토큰 계정 잔액:', balance, '계정:', tokenAccount.pubkey.toString());
          return balance || 0;
        } else {
          setSnaxBalance(0);
          return 0;
        }
      }

      const balance = await connection.getTokenAccountBalance(tokenAccountAddress, commitment);
      setSnaxBalance(balance.value.uiAmount || 0);
      console.debug('[DEBUG] Associated 토큰 잔액:', balance.value.uiAmount);
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
      console.debug('[DEBUG] getSolBalance 호출. 주소:', address);
      const balance = await connection.getBalance(new PublicKey(address), commitment);
      setSolBalance(balance / 1e9);
      console.debug('[DEBUG] SOL 잔액 조회 성공:', balance / 1e9);
    } catch (error) {
      console.error('[ERROR] SOL 잔액 조회 실패:', error);
    }
  }, [connection, commitment]);

  // SNAX 전송 (ATA가 없으면 ATA 생성 + 전송을 같은 트랜잭션에 포함)
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
      console.debug('[DEBUG] sendSnaxTokens 시작', { amount, recipientAddress, snaxBalance });

      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      const mintPublicKey = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');

      // 보내는 사람의 실제 토큰 계정 조회
      const senderTokenAccounts = await connection.getParsedTokenAccountsByOwner(senderPublicKey, { mint: mintPublicKey }, commitment);
      if (senderTokenAccounts.value.length === 0) {
        alert('SNAX 토큰 계정을 찾을 수 없습니다. 토큰 보유 여부를 확인하세요.');
        setIsLoading(false);
        setTransferStatus('');
        return;
      }
      const actualSenderTokenAccount = senderTokenAccounts.value[0].pubkey;
      const actualBalance = senderTokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      const decimals = senderTokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals;
      console.debug('[DEBUG] 발신자 토큰 계정:', actualSenderTokenAccount.toString(), '잔액:', actualBalance, 'decimals:', decimals);

      if (actualBalance < amount) {
        alert(`SNAX 잔액이 부족합니다. 현재 잔액: ${actualBalance} SNAX`);
        setIsLoading(false);
        setTransferStatus('');
        return;
      }

      // 수신자 ATA 주소 계산
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, recipientPublicKey, false);
      console.debug('[DEBUG] 수신자 ATA 예측 주소:', recipientTokenAccountAddress.toString());

      // 정수형(원시 단위)으로 변환 (BigInt)
      const transferAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
      console.debug('[DEBUG] 전송할 토큰 양 (raw BigInt):', transferAmount.toString());

      // ATA 존재 여부 확인
      const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccountAddress, commitment);

      // 최신 블록해시 얻기 (전송 직전에 다시 얻음)
      const latestBlockhash = await connection.getLatestBlockhash(commitment);

      // 한 번의 TX로 ATA 생성 + 전송 처리 (ATA가 없을 때)
      if (recipientAccountInfo === null) {
        console.debug('[DEBUG] 수신자 ATA 없음 -> ATA 생성 + 전송을 하나의 트랜잭션으로 처리합니다.');

        const tx = new Transaction({
          recentBlockhash: latestBlockhash.blockhash,
          feePayer: senderPublicKey,
        });

        // ATA 생성 instruction
        tx.add(
          createAssociatedTokenAccountInstruction(
            senderPublicKey,              // payer
            recipientTokenAccountAddress, // associated token addr
            recipientPublicKey,           // owner of the ATA
            mintPublicKey                 // mint
          )
        );

        // 토큰 전송 instruction
        tx.add(
          createTransferInstruction(
            actualSenderTokenAccount,
            recipientTokenAccountAddress,
            senderPublicKey,
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        console.debug('[DEBUG] 서명 전 트랜잭션:', tx);

        // Phantom에게 서명 요청
        setTransferStatus('✍️ 지갑 서명을 기다리는 중 (ATA 생성 + 토큰 전송)...');
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        setTransferStatus('🔗 트랜잭션 확인 중...');
        await connection.confirmTransaction({
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, commitment);

        console.debug('[DEBUG] ATA 생성 + 전송 완료:', sig);
        alert(`🚀 SNAX 전송 성공! 트랜잭션: ${sig}`);
        setTransferStatus('✅ 전송 완료!');

      } else {
        // ATA가 이미 존재하면 전송만
        console.debug('[DEBUG] 수신자 ATA 존재 -> 전송만 수행');

        const tx = new Transaction({
          recentBlockhash: latestBlockhash.blockhash,
          feePayer: senderPublicKey,
        }).add(
          createTransferInstruction(
            actualSenderTokenAccount,
            recipientTokenAccountAddress,
            senderPublicKey,
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        setTransferStatus('✍️ 지갑 서명을 기다리는 중 (토큰 전송)...');
        console.debug('[DEBUG] 전송 트랜잭션:', tx);

        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        setTransferStatus('🔗 트랜잭션 확인 중...');
        await connection.confirmTransaction({
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, commitment);

        console.debug('[DEBUG] 전송 완료:', sig);
        alert(`🚀 SNAX 전송 성공! 트랜잭션: ${sig}`);
        setTransferStatus('✅ 전송 완료!');
      }

      // 잔액 갱신
      setTimeout(() => getSnaxBalance(walletAddress), 2000);

    } catch (error: any) {
      console.error('[ERROR] SNAX 토큰 전송 실패:', error);
      let errorMessage = `전송 실패: ${error.message || '알 수 없는 에러'}`;
      if (error.message?.includes('User rejected')) errorMessage = '사용자가 트랜잭션을 거부했습니다.';
      if (error.message?.includes('insufficient lamports')) errorMessage = 'SOL 잔액이 부족합니다. 가스비가 필요합니다.';
      // Phantom hook에서 오는 상세 문구를 로그로 보여달라고 요청
      setTransferStatus(`❌ ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, walletAddress, connection, getSnaxBalance, snaxBalance, commitment]);

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
        alert('✅ Devnet으로 연결되었습니다!');
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
          console.log('자동 연결 실패: 사용자의 승인이 필요합니다.');
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
      alert('테스트 SOL 요청이 성공했습니다!');
      setTimeout(() => getSolBalance(walletAddress), 3000);
    } catch (error) {
      console.error(error);
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
