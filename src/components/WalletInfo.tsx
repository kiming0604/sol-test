import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';

// WalletInfo 컴포넌트가 받을 모든 데이터의 타입을 정의합니다.
interface WalletInfoProps {
    walletAddress: string;
    solBalance: number;
    solPrice: { usd: number; krw: number };
    snaxBalance: number;
    onSendSnaxTokens: (amount: number, recipientAddress: string) => void;
    onRefreshSnaxBalance: () => void;
    transferStatus: string;
    isLoading: boolean;
    onDisconnect: () => void;
    onRequestTestSol: () => void;
    onIncrement: () => void;
    onDecrement: () => void;
    onReset: () => void;
    counterValue: number;
    contractAddress: string;
    onNavigateLockup: () => void; // 페이지 이동 함수 타입 추가
}
  
const WalletInfo: React.FC<WalletInfoProps> = ({
  walletAddress,
  solBalance,
  solPrice,
  snaxBalance,
  onSendSnaxTokens,
  onRefreshSnaxBalance,
  transferStatus,
  isLoading,
  onDisconnect,
  onRequestTestSol,
  onNavigateLockup, // props 받기
  // counter 관련 props는 현재 사용하지 않지만, 에러 방지를 위해 받아줍니다.
  onIncrement,
  onDecrement,
  onReset,
  counterValue,
  contractAddress,
}) => {
  const [sendAmount, setSendAmount] = useState<number>(10000);
  const [recipient, setRecipient] = useState<string>('');
  const [showRecipientInput, setShowRecipientInput] = useState<boolean>(false);

  const handleSend = () => {
    if (!recipient) {
      alert('받는 사람의 지갑 주소를 입력해주세요.');
      return;
    }
    try {
      new PublicKey(recipient);
      onSendSnaxTokens(sendAmount, recipient);
    } catch (error) {
      alert('유효하지 않은 지갑 주소입니다.');
    }
  };

  return (
    <div className="wallet-info">
      {/* 기존에 있던 모든 정보 표시 UI를 복구합니다. */}
      <div className="info-item">
        <strong>내 지갑 주소</strong>
        <p className="address">{walletAddress}</p>
      </div>

      <div className="info-item">
        <strong>SOL 잔액</strong>
        <p className="balance">{solBalance.toFixed(4)} SOL</p>
        <p className="price-info">≈ ${(solBalance * solPrice.usd).toFixed(2)} USD</p>
      </div>
      
      <div className="info-item">
        <strong>SNAX 토큰 잔액</strong>
        <p className="balance">{snaxBalance.toLocaleString()} SNAX</p>
        <button onClick={onRefreshSnaxBalance} disabled={isLoading} className="refresh-btn">
          🔄
        </button>
      </div>

      {/* 카운터 섹션도 다시 추가합니다. */}
      <div className="counter-section">
        <h3>Counter Contract</h3>
        <p className="contract-address">{contractAddress}</p>
        <div className="counter-display">
            <p className="counter-value">{counterValue}</p>
        </div>
        <div className="counter-buttons">
            <button onClick={onIncrement} className="counter-btn increment">+</button>
            <button onClick={onDecrement} className="counter-btn decrement">-</button>
            <button onClick={onReset} className="counter-btn reset">Reset</button>
        </div>
      </div>


      <div className="button-group">
        <button onClick={onRequestTestSol} disabled={isLoading}>
          Devnet SOL 받기
        </button>
        <button onClick={() => setShowRecipientInput(!showRecipientInput)} disabled={isLoading}>
          SNAX 토큰 보내기
        </button>
        <button onClick={onNavigateLockup} disabled={isLoading}>
          락업 정보 확인
        </button>
      </div>

      {showRecipientInput && (
        <div className="send-container">
          <input
            type="text"
            placeholder="받는 사람 지갑 주소"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={isLoading}
          />
          <input
            type="number"
            value={sendAmount}
            onChange={(e) => setSendAmount(parseFloat(e.target.value) || 0)}
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading}>
            전송
          </button>
        </div>
      )}

      {transferStatus && <p className="status-message">{transferStatus}</p>}
      
      <button onClick={onDisconnect} className="disconnect-button">
        연결 해제
      </button>
    </div>
  );
};

export default WalletInfo;