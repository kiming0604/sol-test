# Solana Wallet Test

Solana 블록체인과 팬텀 월렛을 연결하는 웹 애플리케이션입니다.

## 기능

1. **팬텀 월렛 연결**: 크롬 확장 프로그램인 팬텀 월렛과 연결
2. **지갑 정보 표시**: 
   - 지갑 주소
   - SOL 잔액
   - USD 가격
   - 원화 가격
3. **카운터 컨트랙트**: 
   - Solana 기반 카운터 스마트 컨트랙트
   - 컨트랙트 주소 표시
   - 카운터 값 조작 (증가, 감소, 리셋)

## 설치 및 실행

### 필요 조건
- Node.js (v16 이상)
- Yarn 패키지 매니저
- 팬텀 월렛 크롬 확장 프로그램

### 설치
```bash
yarn install
```

### 실행
```bash
yarn start
```

애플리케이션이 http://localhost:3000 에서 실행됩니다.

## 프로젝트 구조

```
sol-test/
├── src/
│   ├── App.tsx          # 메인 애플리케이션 컴포넌트
│   ├── App.css          # 스타일시트
│   └── types/
│       └── counter.ts   # 카운터 컨트랙트 타입 정의
├── contracts/
│   ├── counter.rs       # Solana 카운터 컨트랙트 (Rust)
│   └── Cargo.toml       # Rust 프로젝트 설정
├── Anchor.toml          # Anchor 프레임워크 설정
└── package.json         # Node.js 프로젝트 설정
```

## 사용법

1. 팬텀 월렛이 설치되어 있는지 확인
2. 웹사이트에 접속
3. "팬텀 월렛 연결" 버튼 클릭
4. 팬텀 월렛에서 연결 승인
5. 지갑 정보 및 카운터 컨트랙트 확인

## 기술 스택

- **Frontend**: React, TypeScript
- **Blockchain**: Solana, Anchor Framework
- **Wallet**: Phantom Wallet
- **Styling**: CSS3 with modern features

## 주의사항

- 현재 SOL 잔액과 가격은 모의 데이터를 사용합니다
- 실제 Solana 네트워크와 연결하려면 RPC 엔드포인트 설정이 필요합니다
- 컨트랙트는 로컬에서 테스트용으로 작성되었습니다

## 라이선스

MIT License