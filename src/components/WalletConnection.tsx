import React from 'react';

interface WalletConnectionProps {
  onConnect: () => void;
  isLoading: boolean;
}

const WalletConnection: React.FC<WalletConnectionProps> = ({ onConnect, isLoading }) => {
  return (
    <div>
      <button 
        className="connect-button" 
        onClick={onConnect}
        disabled={isLoading}
      >
        {isLoading ? '연결 중...' : '지갑 연결'}
      </button>
      
      <button 
        className="reset-button" 
        onClick={() => window.location.reload()}
        style={{ marginLeft: '10px' }}
      >
        팬텀 월렛 완전 리셋
      </button>
      
      <p className="wallet-status">
        팬텀 월렛과 연결하여 지갑 정보를 확인하세요.<br/>
        버튼을 클릭하면 팬텀 월렛 <strong>크롬 확장프로그램</strong>에서 연결 허용을 요청합니다.<br/>
        <strong>팬텀 월렛 확장프로그램이 열리면 연결을 허용해주세요.</strong><br/>
        <span style={{color: '#ff4757'}}>
          <strong>연결이 안 될 경우 "팬텀 월렛 완전 리셋" 버튼을 먼저 클릭하세요!</strong>
        </span>
      </p>
      
      <div style={{
        marginTop: '15px',
        padding: '15px',
        backgroundColor: '#fff3cd',
        border: '2px solid #ffc107',
        borderRadius: '8px',
        fontSize: '16px',
        color: '#856404',
        fontWeight: 'bold'
      }}>
        <strong style={{ color: '#d63384', fontSize: '18px' }}>⚠️ Solana 네트워크 활성화 필요:</strong><br/>
        <div style={{ marginTop: '10px', lineHeight: '1.6' }}>
          1. 팬텀 월렛 확장프로그램을 열어주세요<br/>
          2. 설정 → 활성 네트워크에서 <strong style={{ color: '#d63384' }}>Solana</strong>를 활성화해주세요<br/>
          3. Solana가 비활성화되어 있으면 연결이 안 됩니다
        </div>
      </div>
      
      {isLoading && (
        <p className="loading-status">
          팬텀 월렛 확장프로그램에서 연결을 허용해주세요...<br/>
          팬텀 월렛 확장프로그램이 열렸는지 확인해주세요.
        </p>
      )}
    </div>
  );
};

export default WalletConnection;
