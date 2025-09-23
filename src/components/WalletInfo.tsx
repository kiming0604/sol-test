import React from 'react';

interface WalletInfoProps {
  walletAddress: string;
  solBalance: number;
  solPrice: { usd: number; krw: number };
  onDisconnect: () => void;
  onRequestTestSol: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  counterValue: number;
  contractAddress: string;
  isLoading: boolean;
}

const WalletInfo: React.FC<WalletInfoProps> = ({
  walletAddress,
  solBalance,
  solPrice,
  onDisconnect,
  onRequestTestSol,
  onIncrement,
  onDecrement,
  onReset,
  counterValue,
  contractAddress,
  isLoading
}) => {
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
