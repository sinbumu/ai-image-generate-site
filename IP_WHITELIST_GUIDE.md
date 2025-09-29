### EC2 Nginx IP 화이트리스트 운영 가이드

이 문서는 EC2에서 `/usr/local/bin/lab-allow.sh` 스크립트를 사용해 Nginx 화이트리스트 파일(`/etc/nginx/allowlist_lab.conf`)을 관리하는 방법을 설명합니다. 모든 명령은 EC2 서버의 터미널에서 실행합니다.

---

### 전제 조건
- **스크립트 설치**: `/usr/local/bin/lab-allow.sh` 가 존재하고 실행 권한이 있어야 합니다.
```bash
sudo chmod +x /usr/local/bin/lab-allow.sh
```
- **Nginx 포함 설정**: 접근 제한을 적용할 서버/위치 블록에 화이트리스트 파일을 포함해야 합니다.
```nginx
# 예시: 특정 라우트 보호
location /admin {
  include /etc/nginx/allowlist_lab.conf;  # 화이트리스트 적용
  proxy_pass http://127.0.0.1:3000;
}

# 또는 서버 전체에 적용하려면 server 블록 초기에 include
# include /etc/nginx/allowlist_lab.conf;
```
- **주의**: 최초 적용 전에 자신의 공인 IP를 화이트리스트에 추가해 잠금 상태가 되지 않도록 하세요.

---

### 내 공인 IP 확인(잠금 방지)
```bash
curl -s https://ifconfig.me
# 출력값 예: 203.0.113.10

# 바로 허용 추가(예)
sudo lab-allow.sh add 203.0.113.10
```

---

### 빠른 시작(가장 많이 쓰는 명령)
- **단일 IP 허용 추가**
```bash
sudo lab-allow.sh add 220.79.235.6
```
- **CIDR 대역 허용 추가**
```bash
sudo lab-allow.sh add 198.51.100.0/24
```
- **현재 규칙 목록 보기**
```bash
sudo lab-allow.sh list
```
- **허용 규칙 제거**
```bash
sudo lab-allow.sh remove 220.79.235.6
```
- **Nginx 설정 재적용(문법 테스트 포함)**
```bash
sudo lab-allow.sh reload
```

---

### 사용법(스크립트 내 `usage` 요약)
```bash
sudo lab-allow.sh add <IP|CIDR>      # 예: 203.0.113.10 또는 198.51.100.0/24
sudo lab-allow.sh remove <IP|CIDR>
sudo lab-allow.sh list
sudo lab-allow.sh reload
```
- **동작 원리**: `/etc/nginx/allowlist_lab.conf` 파일에 `allow <IP|CIDR>;` 라인을 추가/삭제합니다. 파일 끝은 보통 `deny all;` 로 마감하여 화이트리스트 외의 접근을 차단합니다.
- **검증**: 단순한 IPv4 및 CIDR 형식만 허용합니다. 잘못된 값이면 실패합니다.

---

### 화이트리스트 파일 확인
```bash
# 화이트리스트 파일 현재 내용
sudo cat /etc/nginx/allowlist_lab.conf

# 존재하지 않으면 스크립트가 최초 실행 시 자동 생성하며 다음 형태를 포함합니다:
#   # Managed by lab-allow.sh
#   # Add 'allow <IP or CIDR>;' lines above the final 'deny all;'
#   deny all;
```

---

### 작동 예시
```bash
# 1) 현재 내 IP 허용 후 적용
MYIP=$(curl -s https://ifconfig.me)
sudo lab-allow.sh add "$MYIP"

# 2) 특정 사무실 대역 허용
sudo lab-allow.sh add 203.0.113.0/24

# 3) 현재 규칙 확인
sudo lab-allow.sh list

# 4) 불필요해진 규칙 제거
sudo lab-allow.sh remove 203.0.113.0/24
```

---

### 트러블슈팅
- **접속이 막혔어요**: 서버에서 `curl -I https://<도메인>` 으로 내부 접근이 되는지 확인하고, 공인 IP가 바뀌었는지 재확인 후 `add` 하세요.
- **`Invalid IP/CIDR` 오류**: IPv4 또는 `x.x.x.x/yy` 형식인지 확인하세요.
- **Nginx 재적용 실패**: `sudo nginx -t` 로 문법 에러를 확인하고 고친 뒤 `sudo systemctl reload nginx` 하세요.
- **규칙이 중복**: 이미 존재하면 스크립트가 중복 추가를 건너뜁니다. 필요 시 `remove` 로 제거하세요.

---

### 보안 권고
- **최소 허용 원칙**: 꼭 필요한 IP 또는 대역만 추가하세요.
- **변경 직후 검증**: `nginx -t` 결과와 실제 접근 가능 여부를 즉시 확인하세요.
- **IP 변경 대비**: 동적 IP 환경이면 접속 가능한 백업 IP(예: Bastion)를 미리 허용해 두세요.

---

### 부록: 스크립트 경로와 권한 재확인
```bash
which lab-allow.sh || echo "스크립트가 PATH에 없으면 /usr/local/bin/ 에 위치시키세요"
ls -l /usr/local/bin/lab-allow.sh
sudo chmod +x /usr/local/bin/lab-allow.sh
```
