import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../App.css';

// 백엔드로부터 받아올 락업 데이터의 타입을 정의합니다.
// (Spring Boot Lockup.java Entity의 필드명과 일치)
interface LockupData {
  unlockMonth: string;
  amount: number;
  unlocked: boolean; // Spring Boot에서 boolean 필드는 'isUnlocked'이 아닌 'unlocked'으로 직렬화될 수 있습니다.
}

function LockupPage() {
  const [lockups, setLockups] = useState<LockupData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  
  const navigate = useNavigate();

  // 컴포넌트가 처음 렌더링될 때 한 번만 실행됩니다.
  useEffect(() => {
    // 1. localStorage에서 지갑 주소를 읽어옵니다.
    const storedWalletAddress = localStorage.getItem('walletAddress');
    
    if (storedWalletAddress) {
      setWalletAddress(storedWalletAddress);
      
      // 2. 백엔드 API를 호출하여 락업 데이터를 가져옵니다.
      axios.get(`https://dh288s2n217f7.cloudfront.net/api/lockups/${storedWalletAddress}`)
        .then(response => {
          setLockups(response.data); // 성공 시 데이터를 state에 저장
        })
        .catch(err => {
          console.error("락업 정보 조회 실패:", err);
          if (err.response && err.response.status === 404) {
            setError("해당 지갑에 대한 락업 정보가 없습니다.");
          } else {
            setError("락업 정보를 불러오는 데 실패했습니다. 백엔드 서버가 켜져 있는지 확인해주세요.");
          }
        })
        .finally(() => {
          setIsLoading(false); // 로딩 상태 종료
        });
    } else {
      setError("지갑이 연결되어 있지 않습니다. 메인 페이지로 돌아가 지갑을 연결해주세요.");
      setIsLoading(false);
    }
  }, []); // 빈 배열을 전달하여 한 번만 실행되도록 설정

  // 로딩 중일 때 보여줄 UI
  if (isLoading) {
    return <p className="loading-status">락업 정보를 불러오는 중입니다...</p>;
  }

  // 에러가 발생했을 때 보여줄 UI
  if (error) {
    return (
      <div className="lockup-container">
        <p style={{ color: '#ff6b6b' }}>{error}</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
          메인 페이지로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="lockup-container">
      <h3>"{walletAddress?.substring(0, 4)}...{walletAddress?.slice(-4)}" 님의 락업 정보</h3>
      
      <table className="lockup-table">
        <thead>
          <tr>
            <th>언락 월</th>
            <th>락업 수량</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {lockups.map((lockup, index) => (
            <tr key={index}>
              <td>{lockup.unlockMonth}</td>
              <td>{lockup.amount.toLocaleString()} SNAX</td>
              <td>{lockup.unlocked ? '✅ 언락됨' : '🔒 락업 중'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
        메인 페이지로 돌아가기
      </button>
    </div>
  );
}

export default LockupPage;