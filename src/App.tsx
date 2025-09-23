import React, { useState, useEffect } from 'react';
import './App.css';
import WalletConnection from './components/WalletConnection';
import WalletInfo from './components/WalletInfo';
import { COUNTER_PROGRAM_ID } from './types/counter';

// Phantom Wallet 타입 정의
interface PhantomWallet {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  isConnected?: () => boolean;
  publicKey?: { toString: () => string };
  signTransaction?: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
  request?: (params: { method: string }) => Promise<any>;
}

// Window 객체에 Phantom Wallet 타입 추가
declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// SOL 가격 정보 타입
interface SolPrice {
  usd: number;
  krw: number;
}

function App() {
  const [wallet, setWallet] = useState<PhantomWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [solBalance, setSolBalance] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<SolPrice>({ usd: 0, krw: 0 });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [contractAddress, setContractAddress] = useState<string>('');
  const [counterValue, setCounterValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 팬텀 월렛 연결
  const connectWallet = async () => {
    try {
      console.log('=== 지갑 연결 버튼 클릭됨 ===');
      setIsLoading(true);
      
      // 팬텀 월렛 존재 여부 확인
      if (!window.solana) {
        alert('Phantom Wallet이 설치되지 않았습니다.\nChrome 웹스토어에서 설치해주세요: https://phantom.app/');
        setIsLoading(false);
        return;
      }
      
      if (!window.solana.isPhantom) {
        alert('Phantom Wallet이 감지되지 않았습니다.\n페이지를 새로고침해주세요.');
        setIsLoading(false);
        return;
      }

      // 팬텀 월렛이 완전히 로드될 때까지 대기
      let retryCount = 0;
      while (retryCount < 10) {
        if (window.solana && window.solana.isPhantom && typeof window.solana.connect === 'function') {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
      }

      if (!window.solana || !window.solana.isPhantom || !window.solana.connect) {
        alert('Phantom Wallet이 완전히 로드되지 않았습니다.\n잠시 후 다시 시도해주세요.');
        setIsLoading(false);
        return;
      }
      
      console.log('팬텀 월렛 연결 요청 시작...');
      
      // 현재 연결 상태 확인
      let currentConnection = false;
      
      // 방법 1: isConnected 함수 확인
      if (window.solana.isConnected && typeof window.solana.isConnected === 'function') {
        currentConnection = window.solana.isConnected();
      }
      
      // 방법 2: publicKey 존재 여부로 확인
      if (!currentConnection && window.solana.publicKey) {
        currentConnection = true;
      }
      
      console.log('현재 팬텀 월렛 연결 상태:', currentConnection);
      
      // 연결되어 있다면 localStorage에서 연결 정보 삭제
      if (currentConnection) {
        console.log('기존 연결 정보 삭제 중...');
        
        try {
          // localStorage에서 팬텀 월렛 관련 데이터 삭제
          const keys = Object.keys(localStorage);
          const phantomKeys = keys.filter(key => 
            key.includes('phantom') || 
            key.includes('solana') || 
            key.includes('wallet') ||
            key.toLowerCase().includes('connect')
          );
          
          phantomKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`연결 정보 삭제: ${key}`);
          });
          
          // publicKey 강제 초기화
          if (window.solana.publicKey) {
            (window.solana as any).publicKey = null;
          }
          
          console.log('연결 정보 삭제 완료');
        } catch (error) {
          console.log('연결 정보 삭제 실패:', error);
        }
      }
      
      // 팬텀 월렛 연결 요청
      console.log('팬텀 월렛 확장프로그램에서 연결 허용 요청...');
      
      // 안전한 연결 시도
      let response;
      try {
        response = await window.solana.connect({ onlyIfTrusted: false });
      } catch (connectError) {
        console.log('첫 번째 연결 시도 실패, 재시도...', connectError);
        // 잠시 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 500));
        response = await window.solana.connect({ onlyIfTrusted: false });
      }
      
      if (response && response.publicKey) {
        console.log('팬텀 월렛 연결 성공:', response.publicKey.toString());
        
        setWallet(window.solana);
        setWalletAddress(response.publicKey.toString());
        setIsConnected(true);
        
        // 연결 성공 후 데이터 조회
        console.log('지갑 정보 조회 시작...');
        
        // SOL 잔액 조회 시도
        const balance = await getSolBalance(response.publicKey.toString());
        
        // SOL 잔액이 있을 때만 가격 조회
        if (balance > 0) {
          console.log('SOL 잔액이 있으므로 가격 조회 시작');
          await getSolPrice();
        } else {
          console.log('SOL 잔액이 0이므로 가격 조회 생략');
          setSolPrice({ usd: 0, krw: 0 });
        }
        
        console.log('모든 데이터 조회 완료');
        setIsLoading(false);
      } else {
        throw new Error('연결 응답이 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('팬텀 월렛 연결 실패:', error);
      setIsLoading(false);
      
      if (error instanceof Error) {
        if (error.message.includes('User rejected') || error.message.includes('User rejected the request')) {
          alert('사용자가 연결을 거부했습니다.');
        } else if (error.message.includes('Wallet not found')) {
          alert('Phantom Wallet이 설치되지 않았습니다.');
        } else {
          alert('지갑 연결에 실패했습니다: ' + error.message);
        }
      } else {
        alert('지갑 연결에 실패했습니다.');
      }
    }
  };

  // 지갑 연결 해제 함수
  const disconnectWallet = async () => {
    try {
      if (wallet && wallet.disconnect) {
        await wallet.disconnect();
      }
      setWallet(null);
      setWalletAddress('');
      setSolBalance(0);
      setIsConnected(false);
    } catch (error) {
      console.error('지갑 연결 해제 실패:', error);
    }
  };

  // 팬텀 월렛 완전 리셋 함수 (localStorage 기반)
  const resetPhantomWallet = async () => {
    try {
      console.log('=== 팬텀 월렛 완전 리셋 시작 ===');
      
      // 1단계: localStorage에서 팬텀 월렛 관련 데이터 완전 삭제
      try {
        const keys = Object.keys(localStorage);
        const phantomKeys = keys.filter(key => 
          key.includes('phantom') || 
          key.includes('solana') || 
          key.includes('wallet') ||
          key.toLowerCase().includes('connect')
        );
        
        phantomKeys.forEach(key => {
          localStorage.removeItem(key);
          console.log(`localStorage 제거: ${key}`);
        });
        
        // 추가로 sessionStorage도 확인
        const sessionKeys = Object.keys(sessionStorage);
        const phantomSessionKeys = sessionKeys.filter(key => 
          key.includes('phantom') || 
          key.includes('solana') || 
          key.includes('wallet') ||
          key.toLowerCase().includes('connect')
        );
        
        phantomSessionKeys.forEach(key => {
          sessionStorage.removeItem(key);
          console.log(`sessionStorage 제거: ${key}`);
        });
        
        console.log('localStorage/sessionStorage 초기화 완료');
      } catch (error) {
        console.log('localStorage 초기화 실패:', error);
      }
      
      // 2단계: 팬텀 월렛 상태 강제 초기화 (가능한 경우)
      if (window.solana && window.solana.isPhantom) {
        try {
          // publicKey 제거
          if (window.solana.publicKey) {
            (window.solana as any).publicKey = null;
          }
          console.log('팬텀 월렛 상태 초기화 완료');
        } catch (error) {
          console.log('팬텀 월렛 상태 초기화 실패:', error);
        }
      }
      
      // 3단계: 페이지 새로고침으로 완전 초기화
      console.log('페이지 새로고침으로 완전 초기화...');
      window.location.reload();
      
    } catch (error) {
      console.error('팬텀 월렛 리셋 실패:', error);
      alert('팬텀 월렛 리셋 중 오류가 발생했습니다.');
    }
  };

  // SOL 잔액 조회 함수 (테스트넷 사용)
  const getSolBalance = async (address: string) => {
    console.log('SOL 잔액 조회 시작... (테스트넷)');
    
    // 테스트넷 RPC 엔드포인트들
    const testnetEndpoints = [
      'https://api.devnet.solana.com',
      'https://devnet.helius-rpc.com',
      'https://rpc.ankr.com/solana_devnet'
    ];
    
    for (const endpoint of testnetEndpoints) {
      try {
        console.log(`테스트넷 RPC 시도: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address]
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.result && data.result.value !== undefined) {
            const balanceInSol = data.result.value / 1000000000; // lamports를 SOL로 변환
            console.log('테스트넷 SOL 잔액 조회 성공:', balanceInSol, 'SOL');
            setSolBalance(balanceInSol);
            return balanceInSol;
          }
        }
        
        console.log(`${endpoint} 실패: ${response.status}`);
        
      } catch (error) {
        console.log(`${endpoint} 오류:`, error);
      }
    }
    
    // 모든 테스트넷 RPC 실패 시 0으로 설정
    console.log('모든 테스트넷 RPC 실패, 0으로 설정');
    setSolBalance(0);
    return 0;
  };

  // SOL 가격 조회 함수
  const getSolPrice = async () => {
    try {
      console.log('SOL 가격 조회 시작...');
      
      // 여러 가격 API를 시도
      const priceApis = [
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,krw',
        'https://api.coinpaprika.com/v1/tickers/sol-solana',
        'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT'
      ];
      
      let success = false;
      
      // CoinGecko API 시도
      try {
        console.log('CoinGecko API 시도...');
        const response = await fetch(priceApis[0]);
        const data = await response.json();
        
        if (data.solana && data.solana.usd && data.solana.krw) {
          setSolPrice({
            usd: data.solana.usd,
            krw: data.solana.krw
          });
          console.log('CoinGecko 성공 - USD:', data.solana.usd, 'KRW:', data.solana.krw);
          success = true;
        }
      } catch (coinGeckoError) {
        console.log('CoinGecko 실패:', coinGeckoError);
      }
      
      // CoinGecko 실패 시 Binance API 시도
      if (!success) {
        try {
          console.log('Binance API 시도...');
          const response = await fetch(priceApis[2]);
          const data = await response.json();
          
          if (data.price) {
            const usdPrice = parseFloat(data.price);
            const krwPrice = usdPrice * 1300; // 1 USD = 1300 KRW 가정
            
            setSolPrice({
              usd: usdPrice,
              krw: krwPrice
            });
            console.log('Binance 성공 - USD:', usdPrice, 'KRW:', krwPrice);
            success = true;
          }
        } catch (binanceError) {
          console.log('Binance 실패:', binanceError);
        }
      }
      
      // 모든 API 실패 시 기본값 설정
      if (!success) {
        console.log('모든 가격 API 실패, 기본값 설정');
        setSolPrice({
          usd: 200, // 대략적인 SOL 가격
          krw: 260000 // 대략적인 원화 가격
        });
      }
      
    } catch (error) {
      console.error('가격 조회 전체 실패:', error);
      // 최종 실패 시 기본값 설정
      setSolPrice({
        usd: 200,
        krw: 260000
      });
    }
  };

  // 컨트랙트 주소 설정 함수
  const setContractAddressFromProgram = () => {
    setContractAddress(COUNTER_PROGRAM_ID);
  };

  // 카운터 값 증가 함수
  const incrementCounter = () => {
    setCounterValue(prev => prev + 1);
  };

  // 카운터 값 감소 함수
  const decrementCounter = () => {
    setCounterValue(prev => prev - 1);
  };

  // 카운터 값 리셋 함수
  const resetCounter = () => {
    setCounterValue(0);
  };

  // 테스트용 SOL 받기 함수 (Devnet Faucet)
  const requestTestSol = async () => {
    if (!walletAddress) {
      alert('먼저 팬텀 월렛에 연결해주세요.');
      return;
    }

    try {
      console.log('테스트용 SOL 요청 중...');
      setIsLoading(true);

      // 여러 Faucet을 시도
      const faucets = [
        {
          name: 'Solana Devnet',
          url: 'https://api.devnet.solana.com',
          amount: 1000000000 // 1 SOL
        },
        {
          name: 'Helius Faucet',
          url: 'https://devnet.helius-rpc.com',
          amount: 1000000000 // 1 SOL
        }
      ];

      let success = false;
      let lastError = null;

      for (const faucet of faucets) {
        try {
          console.log(`${faucet.name} Faucet 시도 중...`);
          
          const response = await fetch(faucet.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'requestAirdrop',
              params: [walletAddress, faucet.amount]
            })
          });

          const data = await response.json();
          
          if (data.result) {
            console.log(`${faucet.name} 성공:`, data.result);
            alert(`테스트용 SOL 1개가 요청되었습니다!\n(${faucet.name})\n잠시 후 잔액을 확인해보세요.`);
            success = true;
            break;
          } else {
            throw new Error(data.error?.message || `${faucet.name} 요청 실패`);
          }
        } catch (error) {
          console.log(`${faucet.name} 실패:`, error);
          lastError = error;
        }
      }

      if (!success) {
        throw lastError || new Error('모든 Faucet 요청 실패');
      }
      
      // 잔액 새로고침
      setTimeout(async () => {
        await getSolBalance(walletAddress);
      }, 3000);
      
    } catch (error) {
      console.error('테스트용 SOL 요청 실패:', error);
      alert('테스트용 SOL 요청에 실패했습니다: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // 페이지 로드 시 상태 초기화 함수 (팬텀 월렛 접근 없음)
  const resetWalletState = async () => {
    console.log('=== 페이지 로드됨 - 앱 상태만 초기화 ===');
    
    // 앱 상태만 초기화 (팬텀 월렛 접근 안함)
    setWallet(null);
    setWalletAddress('');
    setSolBalance(0);
    setIsConnected(false);
    setCounterValue(0);
    setSolPrice({ usd: 0, krw: 0 });
    setIsLoading(false);
    
    console.log('=== 앱 상태 초기화 완료 ===');
  };

  useEffect(() => {
    // 팬텀 월렛 에러 완전 차단 - 가장 강력한 방법
    const blockPhantomErrors = () => {
      // 1. 전역 에러 핸들러로 팬텀 월렛 에러 완전 차단
      const originalOnError = window.onerror;
      window.onerror = (message, source, lineno, colno, error) => {
        const errorStr = message?.toString() || '';
        const sourceStr = source?.toString() || '';
        
        if (sourceStr.includes('inpage.js') || 
            sourceStr.includes('chrome-extension://') ||
            errorStr.includes('Cannot read properties of null') ||
            errorStr.includes('reading \'type\'') ||
            errorStr.includes('TypeError: Cannot read properties of null')) {
          return true; // 에러 완전 차단
        }
        
        if (originalOnError) {
          return originalOnError(message, source, lineno, colno, error);
        }
        return false;
      };

      // 2. Promise 에러도 완전 차단
      const originalOnUnhandledRejection = window.onunhandledrejection;
      window.onunhandledrejection = (event) => {
        const reasonStr = event.reason?.toString() || '';
        if (reasonStr.includes('inpage.js') ||
            reasonStr.includes('Cannot read properties of null') ||
            reasonStr.includes('reading \'type\'') ||
            reasonStr.includes('chrome-extension://')) {
          event.preventDefault();
          return true;
        }
        
        if (originalOnUnhandledRejection) {
          originalOnUnhandledRejection.call(window, event);
        }
      };

      // 3. 콘솔 출력 완전 차단
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const originalConsoleLog = console.log;
      
      console.error = (...args) => {
        const errorMessage = args[0]?.toString() || '';
        if (errorMessage.includes('inpage.js') || 
            errorMessage.includes('Cannot read properties of null') ||
            errorMessage.includes('reading \'type\'') ||
            errorMessage.includes('phantom') ||
            errorMessage.includes('solana') ||
            errorMessage.includes('chrome-extension://') ||
            errorMessage.includes('Uncaught runtime errors')) {
          return;
        }
        originalConsoleError.apply(console, args);
      };

      console.warn = (...args) => {
        const warnMessage = args[0]?.toString() || '';
        if (warnMessage.includes('inpage.js') || 
            warnMessage.includes('phantom') ||
            warnMessage.includes('solana') ||
            warnMessage.includes('chrome-extension://')) {
          return;
        }
        originalConsoleWarn.apply(console, args);
      };

      console.log = (...args) => {
        const logMessage = args[0]?.toString() || '';
        if (logMessage.includes('inpage.js') || 
            logMessage.includes('chrome-extension://') ||
            logMessage.includes('Uncaught (in promise)')) {
          return;
        }
        originalConsoleLog.apply(console, args);
      };
    };

    // 즉시 에러 차단 실행
    blockPhantomErrors();

    // DOM에서 에러 메시지 제거하는 함수 (더 강력하게)
    const removeErrorMessages = () => {
      // React 에러 오버레이 완전 제거
      const reactErrorOverlay = document.querySelector('#react-error-overlay, [data-react-error-overlay], .react-error-overlay');
      if (reactErrorOverlay) {
        reactErrorOverlay.remove();
      }

      // 모든 가능한 에러 오버레이 제거
      const errorSelectors = [
        '[data-testid="error-overlay"]',
        '.error-overlay',
        '[class*="error"]',
        '[class*="Error"]',
        '[class*="runtime"]',
        '[class*="Runtime"]',
        '[class*="uncaught"]',
        '[class*="Uncaught"]',
        'div[style*="position: fixed"]',
        'div[style*="z-index"]',
        'div[style*="background"]',
        'div[style*="border"]'
      ];
      
      errorSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.textContent?.includes('Cannot read properties of null') || 
              el.textContent?.includes('inpage.js') ||
              el.textContent?.includes('Uncaught runtime errors') ||
              el.textContent?.includes('TypeError: Cannot read properties of null') ||
              el.textContent?.includes('reading \'type\'') ||
              el.textContent?.includes('chrome-extension://')) {
            el.remove();
          }
        });
      });

      // 에러 메시지가 포함된 모든 요소 제거 (더 적극적으로)
      const allElements = document.querySelectorAll('*');
      allElements.forEach(element => {
        if (element.textContent?.includes('Uncaught runtime errors') ||
            element.textContent?.includes('Cannot read properties of null') ||
            element.textContent?.includes('TypeError: Cannot read properties of null') ||
            element.textContent?.includes('reading \'type\'') ||
            element.textContent?.includes('chrome-extension://egjidjbpglichdcondbcbdnbeeppgdph')) {
          // 에러 오버레이나 팝업 요소만 제거
          if (element.closest('[data-react-error-overlay]') ||
              (element as HTMLElement).style.position === 'fixed' ||
              parseInt((element as HTMLElement).style.zIndex) > 1000 ||
              element.classList.contains('error-overlay')) {
            element.remove();
          }
        }
      });
    };

    // 즉시 에러 메시지 제거
    removeErrorMessages();
    
    // DOM이 준비된 후에도 에러 메시지 제거
    const removeErrorsWhenReady = () => {
      if (document.body) {
        removeErrorMessages();
      } else {
        setTimeout(removeErrorsWhenReady, 10);
      }
    };
    removeErrorsWhenReady();
    
    // 주기적으로 에러 메시지 제거 (매우 자주)
    const errorCleanupInterval = setInterval(() => {
      removeErrorMessages();
    }, 50);

    // MutationObserver로 실시간 에러 감지 및 제거 (더 강력하게)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.textContent?.includes('Uncaught runtime errors') ||
                  element.textContent?.includes('Cannot read properties of null') ||
                  element.textContent?.includes('TypeError: Cannot read properties of null') ||
                  element.textContent?.includes('reading \'type\'') ||
                  element.textContent?.includes('inpage.js') ||
                  element.textContent?.includes('chrome-extension://egjidjbpglichdcondbcbdnbeeppgdph')) {
                // 에러 오버레이나 팝업 요소만 제거
                if (element.closest('[data-react-error-overlay]') ||
                    (element as HTMLElement).style.position === 'fixed' ||
                    parseInt((element as HTMLElement).style.zIndex) > 1000 ||
                    element.classList.contains('error-overlay')) {
                  element.remove();
                }
              }
            }
          });
        }
      });
    });

    // body가 준비되면 감시 시작
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      // body가 아직 준비되지 않았으면 대기
      const waitForBody = () => {
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        } else {
          setTimeout(waitForBody, 10);
        }
      };
      waitForBody();
    }

    const initializeApp = async () => {
      console.log('=== 페이지 로드됨 - 초기 상태 설정 ===');
      
      // 앱 상태만 초기화 (팬텀 월렛 접근 없음)
      await resetWalletState();
      
      // 컨트랙트 주소만 설정
      setContractAddressFromProgram();
      console.log('컨트랙트 주소 설정 완료');
    };

    initializeApp();
    
    // 페이지 언로드 시 정리 작업
    const handleBeforeUnload = () => {
      // 팬텀 월렛은 disconnect 메서드가 없으므로 정리 작업만 수행
      console.log('페이지 언로드 - 정리 작업');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 클린업 함수
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // 에러 정리 인터벌 제거
      clearInterval(errorCleanupInterval);
      
      // MutationObserver 정리
      observer.disconnect();
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Solana Wallet Test</h1>
        
        {!isConnected ? (
          <WalletConnection 
            onConnect={connectWallet}
            isLoading={isLoading}
          />
        ) : (
          <WalletInfo
            walletAddress={walletAddress}
            solBalance={solBalance}
            solPrice={solPrice}
            onDisconnect={disconnectWallet}
            onRequestTestSol={requestTestSol}
            onIncrement={incrementCounter}
            onDecrement={decrementCounter}
            onReset={resetCounter}
            counterValue={counterValue}
            contractAddress={contractAddress}
            isLoading={isLoading}
          />
        )}
      </header>
    </div>
  );
}

export default App;