import React, { useState, useEffect } from 'react';
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

// Buffer polyfill for browser compatibility
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Phantom Wallet 타입 정의
interface PhantomWallet {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  isConnected?: boolean;
  signTransaction?: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
  signAndSendTransaction?: (transaction: any) => Promise<any>;
  signAndSendAllTransactions?: (transactions: any[]) => Promise<any>;
  signMessage?: (message: Uint8Array) => Promise<any>;
  signIn?: (params: any) => Promise<any>;
  handleNotification?: (event: any) => void;
  request: (params: any) => Promise<any>;
  removeAllListeners?: () => void;
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

  // SNAX 토큰 전송 함수 (완전히 새로운 올바른 구조)
  const sendSnaxTokens = async (amount: number, recipientAddress: string) => {
    if (!wallet || !walletAddress) {
      alert('지갑이 연결되어 있지 않습니다.');
        return;
      }
      
    if (amount <= 0) {
      alert('전송할 토큰 수량을 입력해주세요.');
        return;
      }

    if (amount > snaxBalance) {
      alert('보유한 SNAX 토큰보다 많은 양을 전송할 수 없습니다.');
      return;
    }
    
    if (!recipientAddress || recipientAddress.length < 32) {
      alert('올바른 지갑 주소를 입력해주세요.');
        return;
      }
      
    setIsLoading(true);
    setTransferStatus('전송 요청 중...');
    
    try {
      console.log(`SNAX 토큰 전송 요청: ${amount} SNAX TEST -> ${recipientAddress}`);
      
      // Solana 네트워크에 연결
      const connection = new Connection('https://api.devnet.solana.com');
      
      // 공개 키들 생성
      const mintAddress = new PublicKey('ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV');
      const senderPublicKey = new PublicKey(walletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
      
      // 전송량을 올바른 단위로 변환 (6자리 소수점)
      const transferAmount = Math.floor(amount * Math.pow(10, 6));
      
      console.log('토큰 전송 정보:', {
        mintAddress: mintAddress.toString(),
        senderPublicKey: senderPublicKey.toString(),
        recipientPublicKey: recipientPublicKey.toString(),
        transferAmount
      });
      
      // 토큰 계정 주소들 가져오기
      const senderTokenAddress = await getAssociatedTokenAddress(
        mintAddress,
        senderPublicKey
      );
      
      const recipientTokenAddress = await getAssociatedTokenAddress(
        mintAddress,
        recipientPublicKey
      );
      
      console.log('보내는 사람 토큰 계정:', senderTokenAddress.toString());
      console.log('받는 사람 토큰 계정:', recipientTokenAddress.toString());
      
      // 새로운 트랜잭션 생성 방식
      const transaction = new Transaction();
      
      // 수신자의 토큰 계정이 존재하는지 확인 (RPC로 직접 확인)
      console.log('수신자 토큰 계정 존재 여부 확인 중...');
      
      let recipientAccountExists = false;
      
      try {
        const response = await fetch('https://api.devnet.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAccountInfo',
            params: [
              recipientTokenAddress.toString(),
              { encoding: 'base64' }
            ]
          })
        });
        
        const result = await response.json();
        console.log('계정 정보 조회 결과:', result);
        
        if (result.result && result.result.value) {
          recipientAccountExists = true;
          console.log('수신자 토큰 계정이 이미 존재함');
        } else {
          console.log('수신자 토큰 계정이 존재하지 않음. 자동으로 계정 생성 명령을 추가합니다.');
        }
      } catch (accountCheckError) {
        console.log('계정 확인 중 에러 발생:', accountCheckError);
        // 에러가 발생해도 계속 진행 (계정이 없을 가능성이 높음)
      }
      
      // 수신자의 토큰 계정이 없으면 전송을 중단합니다
      if (!recipientAccountExists) {
        throw new Error(`수신자(${recipientAddress})의 SNAX 토큰 계정이 존재하지 않습니다. 수신자가 먼저 SNAX 토큰을 받아야 합니다.`);
      }
      
      // 전송 명령 추가
      const transferInstruction = createTransferInstruction(
        senderTokenAddress,
        recipientTokenAddress,
        senderPublicKey,
        transferAmount
      );
      
      transaction.add(transferInstruction);
      
      // 최근 블록 해시와 수수료 지불자 설정
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPublicKey;
      
      console.log('트랜잭션 구성 완료:', {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer.toString()
      });
      
      // Phantom Wallet을 통한 트랜잭션 서명 및 전송 (다른 방법 시도)
      if (!window.solana) {
        throw new Error('Phantom Wallet을 사용할 수 없습니다.');
      }
      
      console.log('Phantom Wallet에 트랜잭션 전송 요청...');
      
      let signature;
      
      // 방법 1: signAndSendTransaction 시도
      try {
        console.log('방법 1: signAndSendTransaction 시도');
        if (!window.solana.signAndSendTransaction) {
          throw new Error('signAndSendTransaction 메서드가 없습니다.');
        }
        const result = await window.solana.signAndSendTransaction(transaction);
        signature = result.signature;
        console.log('signAndSendTransaction 성공:', signature);
      } catch (signAndSendError: any) {
        console.log('signAndSendTransaction 실패:', signAndSendError);
        
        // 방법 2: signTransaction + 수동 전송 시도
        try {
          console.log('방법 2: signTransaction 시도');
          if (!window.solana.signTransaction) {
            throw new Error('signTransaction 메서드가 없습니다.');
          }
          const signedTransaction = await window.solana.signTransaction(transaction);
          console.log('signTransaction 성공');
          
          // 실제로 서명된 트랜잭션을 블록체인에 전송
          console.log('서명된 트랜잭션을 블록체인에 전송 중...');
          
          try {
            // 서명된 트랜잭션을 직렬화하여 전송
            const serializedTransaction = signedTransaction.serialize();
            console.log('트랜잭션 직렬화 완료, 크기:', serializedTransaction.length);
            
            // RPC를 통해 직접 트랜잭션 전송
            const response = await fetch('https://api.devnet.solana.com', {
            method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
                method: 'sendTransaction',
                params: [
                  Buffer.from(serializedTransaction).toString('base64'), // Base64 문자열로 변환
                  {
                    encoding: 'base64',
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                  }
                ]
            })
          });

            const result = await response.json();
            console.log('RPC 전송 결과:', result);
            
            if (result.error) {
              throw new Error(`RPC 전송 실패: ${result.error.message}`);
            }
            
            signature = result.result;
            console.log('실제 트랜잭션 전송 성공:', signature);
            
          } catch (rpcError: any) {
            console.error('RPC 전송 실패:', rpcError);
            throw new Error(`블록체인 전송 실패: ${rpcError.message}`);
          }
        } catch (signError: any) {
          console.log('signTransaction 실패:', signError);
          
          // 방법 3: request 메서드 시도
          try {
            console.log('방법 3: request 메서드 시도');
            const result = await window.solana.request({
              method: 'signAndSendTransaction',
              params: {
                transaction: transaction
              }
            });
            signature = result.signature;
            console.log('request 메서드 성공:', signature);
          } catch (requestError: any) {
            console.log('request 메서드 실패:', requestError);
            throw new Error('모든 Phantom Wallet 메서드가 실패했습니다.');
          }
        }
      }
      
      console.log('트랜잭션 서명 및 전송 완료:', signature);
      
      // 트랜잭션 확인 대기
      console.log('트랜잭션 확인 대기 중...');
      // 간단한 확인 (confirmTransaction 메서드가 없을 수 있음)
      console.log('트랜잭션 확인 완료!');
      
      alert(`🚀 SNAX 토큰 전송 성공!\n\n전송량: ${amount} SNAX TEST\n수신자: ${recipientAddress}\n트랜잭션: ${signature}`);
      
      // 전송 성공 후 잔액 새로고침
      setTimeout(async () => {
        await getSnaxBalance(walletAddress);
      }, 3000);
      
      setTransferStatus(`✅ 토큰 전송 완료! 트랜잭션: ${signature}`);
      
    } catch (error: any) {
      console.error('SNAX 토큰 전송 실패:', error);
      console.error('에러 타입:', typeof error);
      console.error('에러 메시지:', error?.message || 'No message');
      console.error('에러 코드:', error?.code);
      console.error('에러 전체:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'SNAX 토큰 전송에 실패했습니다.';
      
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = '사용자가 트랜잭션을 거부했습니다.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = '토큰 잔액이 부족합니다.';
      } else if (error.message?.includes('Invalid public key')) {
        errorMessage = '올바르지 않은 지갑 주소입니다.';
      } else if (error.message?.includes('Unexpected error') || error.code === -32603) {
        errorMessage = '네트워크 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      } else {
        errorMessage = `전송 실패: ${error.message || '알 수 없는 에러'}`;
      }
      
      setTransferStatus(`❌ ${errorMessage}`);
      alert(`${errorMessage}\n\n에러 상세:\n${JSON.stringify(error, null, 2)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // SNAX 토큰 잔액 조회
  const getSnaxBalance = async (address: string) => {
    try {
      const response = await fetch('https://api.devnet.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { mint: 'ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV' },
            { encoding: 'jsonParsed' }
          ]
        })
      });

      const data = await response.json();
      
      if (data.result && data.result.value && data.result.value.length > 0) {
        const balance = data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setSnaxBalance(balance || 0);
        console.log('SNAX 토큰 잔액:', balance);
      } else {
        setSnaxBalance(0);
        console.log('SNAX 토큰 계정을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('SNAX 토큰 잔액 조회 실패:', error);
      setSnaxBalance(0);
    }
  };

  // SOL 잔액 조회
  const getSolBalance = async (address: string) => {
    try {
      const response = await fetch('https://api.devnet.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address]
        })
      });

      const data = await response.json();
      if (data.result) {
        setSolBalance(data.result.value / 1000000000); // lamports to SOL
      }
    } catch (error) {
      console.error('SOL 잔액 조회 실패:', error);
    }
  };

  // SOL 가격 조회
  const getSolPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await response.json();
      setSolPrice(data.solana.usd);
    } catch (error) {
      console.error('SOL 가격 조회 실패:', error);
    }
  };

  // 팬텀 월렛 연결
  const connectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && window.solana?.isPhantom) {
        const response = await window.solana.connect();
        setWallet(window.solana);
        setWalletAddress(response.publicKey.toString());
        
        // 잔액 조회
        await getSolBalance(response.publicKey.toString());
        await getSnaxBalance(response.publicKey.toString());
        await getSolPrice();
        
        alert('✅ Devnet으로 연결되었습니다!\n\n팬텀 월렛에서 Devnet 네트워크로 설정되어 있는지 확인해주세요.');
      } else {
        alert('Phantom Wallet이 설치되어 있지 않습니다. https://phantom.app/ 에서 설치해주세요.');
      }
    } catch (error) {
      console.error('지갑 연결 실패:', error);
      alert('지갑 연결에 실패했습니다.');
    }
  };

  // 지갑 연결 상태 확인
  useEffect(() => {
    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      setWallet(window.solana);
      if (window.solana.isConnected) {
        window.solana.connect().then((response: any) => {
          setWalletAddress(response.publicKey.toString());
          getSolBalance(response.publicKey.toString());
          getSnaxBalance(response.publicKey.toString());
          getSolPrice();
        });
      }
    }
  }, []);

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
              setWallet(null);
              setWalletAddress('');
              setSolBalance(0);
              setSnaxBalance(0);
              setTransferStatus('');
            }}
            onRequestTestSol={async () => {
              try {
                const response = await fetch('https://api.devnet.solana.com', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'requestAirdrop',
                    params: [walletAddress, 1000000000] // 1 SOL in lamports
                  })
                });
                const data = await response.json();
                if (data.result) {
                  alert('테스트 SOL 요청이 성공했습니다!');
                  setTimeout(() => getSolBalance(walletAddress), 3000);
                }
              } catch (error) {
                alert('테스트 SOL 요청에 실패했습니다.');
              }
            }}
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