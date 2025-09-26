import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';

// --- 이 부분이 가장 중요합니다! ---
// WalletInfo 컴포넌트가 어떤 종류의 데이터를 받을지 정의하는 인터페이스입니다.
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
}
  
// --- 컴포넌트 선언부에 React.FC<WalletInfoProps>를 명시합니다. ---
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
}) => {
  const [sendAmount, setSendAmount] = useState<number>(10000);
  const [recipient, setRecipient] = useState<string>('');
  const [showRecipientInput, setShowRecipientInput] = useState<boolean>(false);
  const navigate = useNavigate();

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

  const goToLockupPage = () => {
    navigate('/lockups');
  };

  return (
    <div className="wallet-info">
      <p><strong>내 지갑 주소:</strong> <span className="address">{walletAddress}</span></p>
      <p>
        <strong>SOL 잔액:</strong> <span className="balance">{solBalance.toFixed(4)} SOL</span> (${(solBalance * solPrice.usd).toFixed(2)})
      </p>
      <p>
        <strong>SNAX 토큰 잔액:</strong> <span className="balance">{snaxBalance.toLocaleString()} SNAX</span>
        <button onClick={onRefreshSnaxBalance} disabled={isLoading} className="refresh-btn">
          🔄
        </button>
      </p>

      <div className="button-group">
        <button onClick={onRequestTestSol} disabled={isLoading}>
          Devnet SOL 받기
        </button>
        <button onClick={() => setShowRecipientInput(!showRecipientInput)} disabled={isLoading}>
          SNAX 토큰 보내기
        </button>
        <button onClick={goToLockupPage} disabled={isLoading}>
          락업 정보 확인
        </button>
        <button onClick={onDisconnect} className="disconnect-btn">
          연결 해제
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
    </div>
  );
};

export default WalletInfo;