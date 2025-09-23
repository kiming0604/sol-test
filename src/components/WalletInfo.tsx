import React, { useState } from 'react';

interface WalletInfoProps {
  walletAddress: string;
  solBalance: number;
  solPrice: { usd: number; krw: number };
  snaxBalance: number;
  onDisconnect: () => void;
  onRequestTestSol: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  counterValue: number;
  contractAddress: string;
  isLoading: boolean;
  onSendSnaxTokens: (amount: number, recipientAddress: string) => void;
  onRefreshSnaxBalance: () => void;
  transferStatus: string;
}

const WalletInfo: React.FC<WalletInfoProps> = ({
  walletAddress,
  solBalance,
  solPrice,
  snaxBalance,
  onDisconnect,
  onRequestTestSol,
  onIncrement,
  onDecrement,
  onReset,
  counterValue,
  contractAddress,
  isLoading,
  onSendSnaxTokens,
  onRefreshSnaxBalance,
  transferStatus
}) => {
  const [sendAmount, setSendAmount] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');

  const handleSendSnax = () => {
    const amount = parseFloat(sendAmount);
    if (amount && recipientAddress) {
      onSendSnaxTokens(amount, recipientAddress);
      setSendAmount('');
      setRecipientAddress('');
    }
  };
  return (
    <div className="wallet-info">
      <h2>지갑 정보 (테스트넷)</h2>
      <div className="info-item">
        <strong>지갑 주소:</strong>
        <p className="address">{walletAddress}</p>
      </div>
      
      <div className="info-item">
        <strong>SOL 잔액:</strong>
        <p className="balance">{solBalance.toFixed(4)} SOL (Devnet)</p>
        <p style={{ fontSize: '14px', color: '#333', marginTop: '5px', fontWeight: 'bold' }}>
          💡 Devnet은 Solana의 테스트넷입니다 (실제 가치 없음)
        </p>
        <div style={{ marginTop: '5px' }}>
          <button 
            className="faucet-button" 
            onClick={onRequestTestSol}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#00d4aa',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginRight: '5px'
            }}
          >
            {isLoading ? '요청 중...' : '테스트용 SOL 받기 (1 SOL)'}
          </button>
          
          <button 
            className="manual-faucet-button" 
            onClick={() => window.open('https://faucet.solana.com/', '_blank')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff6b35',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            수동 Faucet
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#e74c3c', marginTop: '8px', fontWeight: 'bold', backgroundColor: '#ffeaa7', padding: '8px', borderRadius: '4px' }}>
          💡 자동 요청이 안 되면 "수동 Faucet" 버튼을 클릭하여 직접 요청하세요
        </p>
      </div>
      
      <div className="info-item">
        <strong>USD 가격:</strong>
        <p className="price">
          {solBalance > 0 && solPrice.usd > 0 
            ? `$${(solBalance * solPrice.usd).toFixed(2)}` 
            : solBalance === 0 
              ? 'SOL 잔액이 없습니다' 
              : '가격 조회 중...'}
        </p>
        {solBalance > 0 && (
          <p className="price-info">
            SOL 가격: ${solPrice.usd > 0 ? solPrice.usd.toFixed(2) : '조회 중...'}
          </p>
        )}
      </div>
      
      <div className="info-item">
        <strong>원화 가격:</strong>
        <p className="price">
          {solBalance > 0 && solPrice.krw > 0 
            ? `₩${(solBalance * solPrice.krw).toFixed(0)}` 
            : solBalance === 0 
              ? 'SOL 잔액이 없습니다' 
              : '가격 조회 중...'}
        </p>
        {solBalance > 0 && (
          <p className="price-info">
            SOL 가격: ₩{solPrice.krw > 0 ? solPrice.krw.toFixed(0) : '조회 중...'}
          </p>
        )}
      </div>
      
      <div className="info-item">
        <strong>SNAX 토큰 잔액:</strong>
        <p className="balance" style={{ color: '#ff6b35', fontWeight: 'bold' }}>
          {snaxBalance.toLocaleString()} SNAX TEST
        </p>
        <p style={{ fontSize: '14px', color: '#333', marginTop: '5px', fontWeight: 'bold' }}>
          💡 snax를 테스트 해보기 위한 토큰입니다
        </p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
          토큰 주소: ABMiM634jvK9tQp8nLmE7kNvCe7CvE7YupYiuWsdbGYV
        </p>
        
        {/* SNAX 토큰 잔액 새로고침 버튼 */}
        <button
          onClick={onRefreshSnaxBalance}
          disabled={isLoading}
          style={{
            marginTop: '8px',
            padding: '6px 12px',
            backgroundColor: isLoading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isLoading ? '새로고침 중...' : '🔄 잔액 새로고침'}
        </button>
        
        {/* SNAX 토큰 전송 UI */}
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px' }}>
            🚀 SNAX 토큰 전송
          </h4>
          
          {/* 전송할 토큰 수량 입력 */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              전송할 토큰 수량:
            </label>
            <input
              type="number"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="예: 1000"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              disabled={isLoading}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              보유: {snaxBalance.toLocaleString()} SNAX TEST
            </small>
          </div>
          
          {/* 수신자 지갑 주소 입력 */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              수신자 지갑 주소:
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="예: B7EZ6tTXQ2RdLYvqDxvJMNNwLTtCazYgULPNHjoUprFr"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              disabled={isLoading}
            />
          </div>
          
          {/* 전송 버튼 */}
          <button
            onClick={handleSendSnax}
            disabled={isLoading || !sendAmount || !recipientAddress}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: isLoading ? '#ccc' : '#ff6b35',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? '전송 중...' : '🚀 SNAX 토큰 전송'}
          </button>
          
          {/* 전송 상태 표시 */}
          {transferStatus && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: transferStatus.includes('실패') ? '#f8d7da' : '#d4edda',
              border: `1px solid ${transferStatus.includes('실패') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '4px',
              fontSize: '14px',
              color: transferStatus.includes('실패') ? '#721c24' : '#155724'
            }}>
              {transferStatus}
            </div>
          )}
          
          <p style={{ 
            fontSize: '12px', 
            color: '#28a745', 
            marginTop: '8px', 
            marginBottom: '0',
            fontWeight: 'bold'
          }}>
            ✅ 팬텀 월렛이 직접 토큰 전송을 처리합니다!
          </p>
        </div>
      </div>
      
      <div className="info-item">
        <strong>네트워크:</strong>
        <p className="network">Solana Devnet (테스트넷)</p>
      </div>
      
      <div className="info-item">
        <strong>컨트랙트 주소:</strong>
        <p className="contract-address">{contractAddress}</p>
      </div>
      
      <div className="counter-section">
        <h3>카운터 컨트랙트</h3>
        <div className="counter-display">
          <span className="counter-value">{counterValue}</span>
        </div>
        <div className="counter-buttons">
          <button className="counter-btn increment" onClick={onIncrement}>
            +1
          </button>
          <button className="counter-btn decrement" onClick={onDecrement}>
            -1
          </button>
          <button className="counter-btn reset" onClick={onReset}>
            리셋
          </button>
        </div>
      </div>
      
      <button className="disconnect-button" onClick={onDisconnect}>
        연결 해제
      </button>
    </div>
  );
};

export default WalletInfo;
