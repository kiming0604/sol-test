#!/bin/bash

# AWS Amplify 배포 스크립트

echo "🚀 AWS Amplify 배포를 시작합니다..."

# 1. 의존성 설치
echo "📦 의존성을 설치합니다..."
npm install

# 2. 빌드 테스트
echo "🔨 빌드를 테스트합니다..."
npm run build

# 3. 빌드 성공 확인
if [ $? -eq 0 ]; then
    echo "✅ 빌드가 성공적으로 완료되었습니다!"
    
    # 4. Git 상태 확인
    echo "📋 Git 상태를 확인합니다..."
    git status
    
    # 5. 변경사항 커밋 (선택사항)
    read -p "변경사항을 커밋하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Deploy to AWS Amplify"
        git push origin main
        echo "✅ 변경사항이 GitHub에 푸시되었습니다!"
    fi
    
    echo "🎉 배포 준비가 완료되었습니다!"
    echo "📝 다음 단계:"
    echo "   1. AWS Amplify 콘솔에 접속하세요"
    echo "   2. 'Host web app'을 클릭하세요"
    echo "   3. GitHub 저장소를 연결하세요"
    echo "   4. 빌드 설정을 확인하세요"
    echo "   5. 배포를 시작하세요"
    
else
    echo "❌ 빌드에 실패했습니다. 오류를 확인해주세요."
    exit 1
fi
