좋아요. **RDB + 이미지/영상 저장소**를 포함해서, 프론트/백 추가 기능까지 한 번에 정리해볼게요. (JS 코드는 안 넣었습니다.)

# 전체 구조(업데이트)

* **Next.js 단일 앱**(프론트+백)
* **PostgreSQL**(RDS 또는 EC2 내 Docker) ← 이력/메타데이터 저장
* **오브젝트 스토리지**(S3 또는 R2) ← 원본/결과 이미지·영상 저장
* **Nginx + Let’s Encrypt**(EC2) ← 리버스 프록시/HTTPS
* (선택) **CloudFront/R2 Public Bucket** 없이도 내부 테스트면 presigned URL만으로 충분

# 데이터 모델(개념)

* **User**: 내부 고정 계정 1개라도 테이블은 둡니다(확장 대비).

  * `id`, `login_id`, `role`, `created_at`
* **Job**: 한 번의 생성 요청 단위(GPT/Hailuo 공용).

  * `id`, `user_id(FK)`, `provider`(gpt|hailuo), `prompt`, `options(JSONB)`,
    `status`(queued|running|done|error), `request_id`(OpenAI x-request-id), `provider_task_id`(hailuo task id),
    `created_at`, `completed_at`, `error_message`
* **Asset**: 업로드/결과 파일 메타.

  * `id`, `job_id(FK)`, `kind`(input|mask|result|thumbnail), `mime`, `bytes`,
    `bucket`, `key`, `sha256`, `etag`, `width`, `height`, `duration_sec`,
    `created_at`
* **PromptCache(선택)**: 동일 프롬프트/옵션/입력 이미지 해시 조합 캐시.

  * `id`, `fingerprint(sha256)`, `job_id(FK)`, `created_at`
* **Audit(선택)**: 로그인/다운로드/삭제 같은 이벤트 로그.

> 인덱스: `job.user_id+created_at DESC`, `asset.job_id`, `job.provider_task_id`, `job.request_id`.

# 파일 저장 전략

* **버킷 구조**: `env/provider/YYYY/MM/DD/{jobId}/`
  예) `dev/gpt/2025/08/13/abcd-.../result.png`
* **권한**: 버킷은 **Private**. 접근은 **Presigned URL**(GET/PUT)로만.
* **원본·마스크**는 업로드 직후 S3로, **결과물**도 S3로 “복사 저장”해 **링크 안정성** 확보(외부 결과 URL 의존 X).
* **썸네일**(이미지) 또는 **포스터 프레임**(영상) 별도 생성하여 리스트 속도 개선.
* **라이프사이클**: 30\~90일 후 Glacier/삭제(테스트 목적이면 적극 설정).

# 업로드/다운로드 흐름

* **클라이언트 → 스토리지 직접 업로드(권장)**

  1. 백엔드가 **Presigned PUT URL** 발급(파일명·MIME·최대크기·유효기간 포함)
  2. 클라이언트가 해당 URL로 직접 업로드
  3. 업로드 완료 후, 백엔드에 **업로드 완료 콜백**(key, size, sha256 등) 전달 → `Asset(kind=input|mask)` 기록
* 결과물은 **백엔드가 수신 후 자체적으로 S3에 저장**하고, 뷰어에는 **Presigned GET URL**을 발급.

# 백엔드 추가 기능(요약)

1. **인증 유지**: 기존 고정 계정 로그인 + 쿠키. (앞단 Nginx Basic Auth는 그대로 유지 가능)
2. **스토리지 연동 API**

   * `POST /api/storage/presign-put` : 업로드용 URL 발급(파일 메타 검증 포함)
   * `POST /api/storage/confirm` : 업로드 완료 보고 → `Asset` 등록
3. **생성 실행 API**

   * GPT: 기존 `/api/gpt/edit` 로직에 **DB 연동 추가**(Job 생성 → 결과 저장 → 상태 갱신)
   * Hailuo: `POST /api/hailuo/task`(Job 생성) + `GET /api/hailuo/task/:id`(상태 조회)

     * **가능하면 Webhook** 엔드포인트 추가(`POST /api/hailuo/callback`) → 폴링 감소
     * Webhook 미지원이면 **서버 크론/타이머로 폴링 워커**(systemd timer/cron) 운영
4. **히스토리/재조회 API**

   * `GET /api/jobs?provider=&status=&q=&page=` : 로그인 사용자의 작업 목록(페이지네이션, 검색)
   * `GET /api/jobs/:id` : 상세(프롬프트, 옵션, 에셋 목록, 상태, 에러)
   * `POST /api/jobs/:id/rerun` : 같은 프롬프트/옵션/입력으로 재실행
   * `GET /api/assets/:id/url` : Presigned GET 반환(짧은 TTL)
5. **관리/청소 API(옵션)**

   * `POST /api/jobs/:id/delete` : Job soft-delete(또는 하드 삭제)
   * `POST /internal/housekeeping` : 오래된 Job/Asset 정리(라이프사이클과 중복 방지)

# 프론트 추가 화면/UX

* **탭**: (1) GPT 이미지 (2) Hailuo 영상 (3) **히스토리**
* **히스토리 목록**: 썸네일/포스터, 프롬프트 요약, 상태, 생성일, 액션(보기/다운로드/재실행/삭제)
* **상세 뷰**: 입력/마스크/결과 에셋 갤러리, 요청 메타(옵션, x-request-id, task id), 로그 메시지, 재실행 버튼
* **업로드 UX**: 대용량 진행률 표시, 용량/형식 사전 검증, 재업로드(교체)
* **권한**: 단일 계정이지만 UI 레벨에서 “내 작업”으로 제한(멀티 계정 전환 대비)

# 운영/성능/보안 체크

* **사이즈 제한**: Nginx `client_max_body_size`, API에서 별도 체크(예: 이미지 50MB, 영상 500MB 등 환경에 맞게)
* **MIME 검증**: 서버 측 `content-type` 화이트리스트, 이미지/영상 시그니처 스NIFF
* **해시**: 업로드 직후 SHA-256 계산(중복 업로드 감지·캐시 키로 사용)
* **레이트 리미트**: Nginx 또는 앱에서 IP/경로별 간단 제한
* **키 보관**: OPENAI/HAILUO 키는 환경변수 + 권한 최소화, 리포지토리 커밋 금지
* **로그**: DB에 핵심 메타만(프롬프트 전문은 보관 선택), OpenAI `x-request-id`/hailuo task id 저장
* **비용**: S3/R2 라이프사이클로 자동 정리, 썸네일만 오래 보관
* **장애대응**: 하드 실패 시 재시도(백오프), Hailuo 폴링 워커는 락/중복 실행 방지

# 배치/워커(폴링/웹훅)

* **우선순위**: Webhook 지원 시 Webhook → DB 업데이트 → 알림/리프레시
* **미지원 시**: EC2에서 `systemd timer` 또는 `cron`으로 **주기 폴링 워커** 실행

  * 수행: `status in (queued,running)`인 hailuo Job들의 상태 조회→변경 시 DB 반영→완료 시 결과 다운로드→S3 저장

# 선택지 비교(스토리지)

* **S3**: AWS 내에서 표준. CloudFront 붙이면 대용량 스트리밍/서명URL 용이.
* **R2**: 비용↓/egress 유리. 이미 R2 쓰고 있으면 동일 패턴(프리사인드)로 충분.

# 최소 실행 순서(체크리스트)

1. **RDS(Postgres)** 생성 → 보안그룹/암호관리
2. **S3/R2 버킷** 생성 → 프라이빗, 라이프사이클 정책, KMS(선택)
3. **.env**에 DB/버킷/키 설정
4. 백엔드에 **presign-put/confirm**, **jobs**, **assets** API 추가
5. GPT/Hailuo 실행 API에 **DB 연동 + S3 저장** 추가
6. 프론트에 **히스토리 탭/상세** 추가, 보기/다운로드는 presigned GET 사용
7. (옵션) Hailuo **Webhook** 또는 **폴링 워커** 설치
8. Nginx 업로드 한도/타임아웃/레이트리밋 조정

---

요약:

* **Postgres**로 이력과 메타만 저장, **S3/R2**로 바이너리 저장(사설 버킷 + presigned).
* 프론트는 **히스토리/상세/재실행** 추가, 백엔드는 **presign/confirm, jobs, assets** API와 **워커**만 보강하면 됩니다.
* 내부 테스트 목적에 딱 맞고, 추후 멀티 계정/확장도 부드럽게 갈 수 있는 구조예요.
