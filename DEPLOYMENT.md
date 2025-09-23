# AWS Amplify 배포 가이드

## 1. AWS Amplify 콘솔에서 배포

### 방법 1: GitHub 연동 배포

1. **GitHub에 코드 푸시**
   ```bash
   git add .
   git commit -m "Initial commit for Amplify deployment"
   git push origin main
   ```

2. **AWS Amplify 콘솔 접속**
   - AWS 콘솔 → Amplify → "Host web app" 클릭
   - GitHub 선택 후 저장소 연결

3. **빌드 설정**
   - 프레임워크: React
   - 빌드 명령어: `npm run build`
   - 출력 디렉토리: `build`
   - Node.js 버전: 18.x

4. **환경 변수 설정 (필요시)**
   - Amplify 콘솔 → App settings → Environment variables
   - `NODE_ENV=production` 추가

### 방법 2: Amplify CLI 사용

1. **Amplify CLI 설치**
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   ```

2. **프로젝트 초기화**
   ```bash
   amplify init
   amplify add hosting
   amplify publish
   ```

## 2. 도메인 설정

1. **커스텀 도메인 연결**
   - Amplify 콘솔 → Domain management
   - 도메인 추가 및 SSL 인증서 설정

2. **DNS 설정**
   - Route 53 또는 도메인 제공업체에서 CNAME 설정

## 3. 환경별 설정

### 개발 환경
- 브랜치: `develop`
- 환경 변수: `NODE_ENV=development`

### 프로덕션 환경
- 브랜치: `main`
- 환경 변수: `NODE_ENV=production`

## 4. 자동 배포 설정

1. **브랜치별 자동 배포**
   - main 브랜치: 프로덕션 자동 배포
   - develop 브랜치: 스테이징 자동 배포

2. **빌드 알림 설정**
   - Slack, Discord, 이메일 알림 설정 가능

## 5. 모니터링 및 로그

1. **CloudWatch 로그 확인**
   - Amplify 콘솔 → App → Logs

2. **성능 모니터링**
   - CloudWatch 메트릭으로 성능 추적

## 6. 보안 설정

1. **HTTPS 강제 설정**
   - Amplify에서 자동으로 HTTPS 제공

2. **CORS 설정**
   - 필요시 API Gateway에서 CORS 설정

## 7. 트러블슈팅

### 빌드 실패 시
1. 로컬에서 `npm run build` 테스트
2. Node.js 버전 확인 (18.x 권장)
3. 의존성 충돌 확인

### 배포 후 에러 시
1. CloudWatch 로그 확인
2. 브라우저 개발자 도구에서 에러 확인
3. 네트워크 탭에서 리소스 로딩 확인

## 8. 비용 최적화

1. **CloudFront 캐싱 설정**
   - 정적 자산 캐싱 최적화

2. **압축 설정**
   - Gzip/Brotli 압축 활성화

3. **CDN 설정**
   - 전 세계 엣지 로케이션 활용
