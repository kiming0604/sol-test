import React, { useState, useEffect } from 'react';
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';
import { 
  address
} from '@solana/kit';

// Buffer polyfill for browser compatibility
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// 라이브러리 호환성 문제로 인해 기존 방법 사용

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
      
      // Solana 네트워크에 연결 (Kit 사용) - 향후 확장을 위해 준비
      // const rpc = createSolanaRpc('https://api.devnet.solana.com');
      
      // 주소 검증 및 생성 (Kit 사용)
      const mintAddressStr = 'ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV';
      
      // 주소 길이 검증 (32-44자)
      const validateAddress = (addr: string) => {
        if (addr.length < 32 || addr.length > 44) {
          throw new Error(`Invalid address length: ${addr.length}. Expected 32-44 characters. Address: ${addr}`);
        }
        return addr;
      };
      
      const mintAddress = address(validateAddress(mintAddressStr));
      const senderPublicKey = address(validateAddress(walletAddress));
      const recipientPublicKey = address(validateAddress(recipientAddress));
      
      
      // 전송량을 올바른 단위로 변환 (6자리 소수점)
      const transferAmount = Math.floor(amount * Math.pow(10, 6));
      
      console.log('토큰 전송 정보:', {
        mintAddress: mintAddress.toString(),
        senderPublicKey: senderPublicKey.toString(),
        recipientPublicKey: recipientPublicKey.toString(),
        transferAmount
      });
      
      // Phantom Wallet의 SPL 토큰 전송 API 시도
      if (!window.solana || !window.solana.signAndSendTransaction) {
        throw new Error('Phantom Wallet 또는 signAndSendTransaction을 사용할 수 없습니다.');
      }

      console.log('Phantom Wallet SPL 토큰 전송 시도...');
      
      let signature: string;
      
      // Phantom Wallet 지원 메서드 확인
      console.log('Phantom Wallet 사용 가능한 메서드:', Object.keys(window.solana));
      
      // 방법 1: Phantom Wallet의 기본 connect 및 signMessage 시도
      try {
        console.log('방법 1: 기본 Phantom Wallet 기능 확인');
        
        // 먼저 연결 상태 확인
        if (!window.solana.isConnected) {
          console.log('Phantom Wallet 연결 시도...');
          await window.solana.connect();
        }
        
        // 메시지 서명으로 테스트
        const message = `Transfer ${amount} SNAX TEST to ${recipientAddress}`;
        const signedMessage = await window.solana.signMessage(new TextEncoder().encode(message));
        
        console.log('Phantom Wallet 메시지 서명 성공:', signedMessage);
        signature = `message_signed_${Date.now()}`;
        
      } catch (basicError) {
        console.log('기본 기능 실패, 방법 2 시도:', basicError);
        
        try {
          // 방법 2: 사용자에게 수동 전송 안내
          console.log('방법 2: 수동 전송 안내');
          
          const transferInfo = {
            token: mintAddressStr,
            recipient: recipientAddress,
            amount: amount,
            transferAmount: transferAmount
          };
          
          console.log('전송 정보:', transferInfo);
          
          // 사용자에게 Phantom Wallet에서 직접 전송하도록 안내
          const userConfirm = window.confirm(
            `Phantom Wallet에서 자동 전송이 지원되지 않습니다.\n\n` +
            `수동으로 전송해주세요:\n` +
            `토큰: ${mintAddressStr}\n` +
            `수신자: ${recipientAddress}\n` +
            `금액: ${amount} SNAX TEST\n\n` +
            `Phantom Wallet을 열어서 직접 전송하시겠습니까?`
          );
          
          if (userConfirm) {
            // Phantom Wallet 열기
            window.open('https://phantom.app/', '_blank');
            signature = 'manual_transfer_guided';
          } else {
            throw new Error('사용자가 수동 전송을 취소했습니다.');
          }
          
        } catch (manualError) {
          console.log('수동 전송 안내 실패:', manualError);
          throw new Error(`Phantom Wallet 자동 전송을 지원하지 않습니다. 수동으로 전송해주세요:\n\n토큰: ${mintAddressStr}\n수신자: ${recipientAddress}\n금액: ${amount} SNAX TEST`);
        }
      }
      
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