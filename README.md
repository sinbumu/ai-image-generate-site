## AI Media Toy (Next.js, pages router)

프록시형 AI 생성(OPENAI 이미지 편집, Hailuo 영상 생성) + SQLite 히스토리 저장 미니 프로젝트입니다.

### 요구 환경
- Node.js 18+
- npm
- (운영 권장) `~/.env.local` 환경변수

```bash
# S3 / R2 (필수)
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_REGION=ap-northeast-2
# R2 사용하는 경우만
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com

# 업로드 경로 prefix(선택)
S3_PREFIX=ai-media-toy/prod

# 키 해시 솔트(서버 저장용)
KEY_HASH_SALT=change_me

# MIJI 템플릿 어드민 API 베이스 URL(프론트)
NEXT_PUBLIC_MIIJ_DEV_BASE=https://prod-dev.cccv.to
NEXT_PUBLIC_MIIJ_PROD_BASE=https://prod-renewal-cccv.cccv.to
```

### 로컬 개발
```bash
npm i
npm run dev
# http://localhost:3000
```

### 빌드/운영 실행 (EC2 직접 배포)
```bash
# 1) 의존성 설치
# 빌드를 서버에서 수행하므로 devDependencies 포함 설치 필요
npm ci

# 2) 빌드
npm run build

# 3) 실행 (포그라운드)
npm run start

# PM2 등 프로세스 매니저 사용 예시
npm i -g pm2
NODE_ENV=production pm2 start "npm run start" --name ai-media-toy
pm2 save

# (선택) 빌드 후 런타임 절감
# npm prune --production && pm2 restart ai-media-toy
```

### 재배포(업데이트) 절차
```bash
# 서비스 중단 없이 업데이트(권장)
cd /home/ec2-user/ai-media-toy   # 실제 배포 경로로 이동
git pull --ff-only origin main   # 또는 git fetch && git reset --hard origin/main

# 의존성/빌드 (devDependencies 포함)
sudo npm ci
sudo npm run build

# 재시작
sudo pm2 restart ai-media-toy && sudo pm2 save
```

확인 체크리스트
- Next 정적 자산: `/_next/static/<BUILD_ID>/_buildManifest.js`가 200이어야 함
  ```bash
  curl -I http://127.0.0.1:3000/_next/static/$(cat .next/BUILD_ID)/_buildManifest.js
  ```
- CSS 미적용 시: devDependencies 없이 빌드했는지 확인 후 `npm ci`로 재설치 → `npm run build`
- Nginx 리로드: `sudo nginx -t && sudo systemctl reload nginx`

### Cloudflare R2(서버 고정 크레덴셜) 사용
프론트의 “사전 업로드”는 `/api/presign`을 호출해 presigned PUT URL을 받습니다. 서버에 R2 크레덴셜을 고정해 두면 자동으로 R2를 사용합니다.

1) R2에서 준비할 정보
- Access Key ID / Secret Access Key
- Account ID 기반 Endpoint: `https://<accountid>.r2.cloudflarestorage.com`
- Bucket: 예) `dev-miji-photocard`

2) 서버 `.env.local` 설정 예시
```bash
S3_ACCESS_KEY=<R2_ACCESS_KEY_ID>
S3_SECRET_KEY=<R2_SECRET_KEY>
S3_BUCKET=dev-miji-photocard
S3_REGION=auto
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_PREFIX=ai-media-toy/prod   # 선택(프로젝트 전용 경로)
```

3) R2 CORS/공개 읽기 설정(필수)
- CORS에 `https://lab.cccv.to` 허용(Origins): Methods `PUT,GET,HEAD`, Headers `*`, Expose `ETag`.
- 공개 읽기: `S3_PREFIX` 하위만 Public Read 권장(데모는 버킷 전체 Public Read 가능).

4) presign 동작 확인
```bash
curl -s -X POST https://lab.cccv.to/api/presign \
  -H 'content-type: application/json' \
  -d '{"filename":"test.png","contentType":"image/png"}'
# => uploadUrl, objectUrl 가 반환돼야 합니다.
```

5) 배포 반영
```bash
pm2 stop ai-media-toy || true
cd /home/ec2-user/ai-media-toy
npm ci && npm run build
NODE_ENV=production pm2 start "npm run start" --name ai-media-toy --update-env
pm2 save
```

### 템플릿 어드민(/template) 사용법
- 접근: 로컬 개발 서버에서 `/template` 접속
- 환경 토글: 상단 드롭다운으로 `dev/prod` 전환, prod는 주의 배지 표시
- 프레임 생성: `frameName`, `event`, `sampleImageUrl` 입력 후 이미지 업로드 → 생성
- 스타일 관리:
  - 목록에서 `수정`으로 편집 폼 자동 채움, `삭제`로 제거
  - `styleType`이 GPT_HAILUO이면 `gptPromptList`, `gptSampleImageUrlList`, `hailuoPromptList`를 키-값 편집기로 입력
  - 이미지/비디오 업로드는 presign 기반, 업로드 후 URL 자동 주입
- 스냅샷/디프:
  - dev에서 `dev 스냅샷 저장` → prod에서 `스냅샷과 PROD 비교`
  - 프레임 추가 자동 적용, 스타일은 단순 업서트 버튼 제공(GPT_HAILUO 자동 매핑 지원)
- 사용법 모달: 상단 `사용법?` 버튼

환경 변수 요약
```bash
NEXT_PUBLIC_MIIJ_DEV_BASE=https://prod-dev.cccv.to
NEXT_PUBLIC_MIIJ_PROD_BASE=https://prod-renewal-cccv.cccv.to
```

### EC2 배포 가이드(도커 미사용)
1) Amazon Linux2/Ubuntu에 Node.js 18+ 설치
2) 레포 클론 또는 GitHub Actions에서 EC2로 pull
3) `.env.local` 작성 (위 환경변수 참고)
4) `npm ci --omit=dev && npm run build`
5) `npm run start` 또는 PM2로 상시 실행
6) 보안그룹에서 3000 포트(또는 Nginx 리버스 프록시 80/443) 오픈
7) Route53에서 A레코드를 EC2 퍼블릭 IP로 매핑(고정 IP 필요 시 EIP 할당)

참고: Nginx 리버스 프록시 예시
```
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### GitHub 커밋/푸시
```bash
git add -A
git commit -m "feat: initial proxy + sqlite history + ui"
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

### 운영 체크리스트
- 서버 로그에 키가 남지 않도록 헤더 로깅 금지(현재 코드 안전)
- presign은 퍼블릭 읽기 버킷/경로 전제. 운영은 서명 URL/CloudFront 권장
- 보안그룹/방화벽/HTTPS(TLS) 적용 권장(Nginx+Let’s Encrypt)

