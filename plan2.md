### Pixverse Transition (First-Last Frame) Generation 기능 추가 정리

사용자의 요청에 따라, 기존 어드민 페이지에 Pixverse의 Transition (First-Last Frame) Generation 기능을 추가하는 조건을 체계적으로 정리하였습니다. 이는 기존 GPT 이미지 생성과 Hailou 영상 생성 패턴을 기반으로 하며, 프론트 UI와 기본 틀은 기존 사이트 구조를 유지합니다. 추가로 제공된 API 예시(curl 요청, 응답 형식 등)를 API 흐름 섹션에 포함하여 더 구체적인 구현 가이드를 제공합니다. 아래에서 기능 설계, UI 배치, API 흐름을 단계별로 분류하여 설명합니다.

#### 1. 기능 패턴 및 구조
- **기존 패턴 유지**: GPT 이미지 생성과 Hailou 영상 생성과 동일하게 설계합니다.
  - **생성 박스**: 사용자가 First Frame과 Last Frame 이미지를 업로드하고, 영상 생성을 요청할 수 있는 입력 영역(예: 파일 업로드 필드, 프롬프트 입력, 생성 버튼).
  - **생성 히스토리**: 최근 생성 요청 목록(요청 시간, 상태, 결과 링크 등)을 표시.
  - **저장한 생성물 목록**: 사용자가 저장한 영상 결과 목록(썸네일, 다운로드 링크 등).
- **추가 기능**: Pixverse Transition 기능은 두 개의 이미지(First Frame과 Last Frame)를 기반으로 영상 전환을 생성합니다. 생성 과정은 비동기(폴링 기반)로 처리합니다.

#### 2. UI 배치
- **기존 UI와의 통합**: 프론트 UI는 기존 사이트 구조(예: 대시보드 레이아웃, 네비게이션 등)를 그대로 유지합니다.
- **배치 방식**:
  - 기존 GPT와 Hailou는 같은 행에 2열로 배치되어 있지만, Pixverse를 추가할 때 3열로 하면 UI가 좁아질 수 있으므로 **새로운 행에 Pixverse 섹션을 배치**합니다.
    - 예시 레이아웃:
      - 행 1: GPT (1열) | Hailou (2열)
      - 행 2: Pixverse (전체 행 또는 중앙 정렬)
  - 각 섹션 내: 상단에 생성 박스, 그 아래 히스토리와 저장 목록(탭 또는 섹션으로 구분).
- **API 키 입력**: 기존 API들처럼 상단에 Pixverse API 키 입력 필드와 저장 버튼을 배치하여, 키를 저장하고 재사용하도록 유도합니다. (키 저장은 로컬 스토리지 또는 백엔드 DB 사용 추천).

#### 3. API 흐름 및 구현 가이드
Pixverse API는 파일 업로드 → 영상 생성 요청 → 상태 폴링 순으로 진행됩니다. 백엔드(예: Spring Boot)에서 API 호출을 처리하고, 프론트에서 결과를 표시합니다. 아래는 단계별 흐름과 제공된 curl 예시, 응답 형식입니다. 주의: 응답 필드명(대소문자)이 상태 코드에 따라 다를 수 있으므로(예: 200 vs 500), 코드에서 유연하게 처리하세요.

- **단계 1: 이미지 업로드 (Upload Image API)**
  - **목적**: First Frame과 Last Frame 이미지를 Pixverse 서버에 업로드하여 ID와 URL을 획득합니다.
  - **API 엔드포인트**: POST https://app-api.pixverse.ai/openapi/v2/image/upload.
  - **curl 요청 예시**:
    ```
    curl --location --request POST 'https://app-api.pixverse.ai/openapi/v2/image/upload' \
    --header 'API-KEY: your-api-key' \
    --header 'Ai-trace-id: {{$string.uuid}}' \
    --form 'image=@""'
    ```
  - **200 응답 예시**:
    ```
    {
        "ErrCode": 0,
        "ErrMsg": "string",
        "Resp": {
            "img_id": 0,
            "img_url": "string"
        }
    }
    ```
  - **500 응답 예시** (필드명 주의: ErrCode → err_code, 등 대소문자 변경됨):
    ```
    {
        "err_code": 500052,
        "err_msg": "图片未过审，疑含敏感内容，请修改后重试。",
        "resp": null
    }
    ```
  - **파라미터**: Authorization: API-KEY {your-api-key}, 멀티파트 폼 데이터로 이미지 파일 첨부 (First와 Last 별도로 호출).
  - **구현 팁**: 프론트에서 파일 선택 후 백엔드로 전달, 백엔드에서 Pixverse API 호출. 각 이미지에 대해 별도 업로드. 응답에서 img_id와 img_url 저장 (Transition에서 사용).

- **단계 2: 영상 생성 요청 (Transition First-Last Frame Generation API)**
  - **목적**: 업로드된 First와 Last 이미지를 기반으로 영상 전환 생성을 요청합니다.
  - **API 엔드포인트**: POST https://app-api.pixverse.ai/openapi/v2/video/transition/generate.
  - **curl 요청 예시**:
    ```
    curl --location --request POST 'https://app-api.pixverse.ai/openapi/v2/video/transition/generate' \
    --header 'API-KEY: your-api-key' \
    --header 'Ai-Trace-Id: {{$string.uuid}}' \
    --header 'Content-Type: application/json' \
    --data-raw '{
        "prompt": "transform into a puppy",
        "model": "v5",
        "duration": 5,
        "quality": "540p",
        //"motion_mode": "normal",
        "first_frame_img": 0,
        "last_frame_img": 0,
        //"sound_effect_switch":true,
        //"sound_effect_content":"",
        //"lip_sync_tts_switch":true,
        //"lip_sync_tts_content":"",
        //"lip_sync_tts_speaker_id":"",
        "seed": 0
    }'
    ```
  - **응답 예시** (200과 500 동일 형식):
    ```
    {
        "ErrCode": 0,
        "ErrMsg": "string",
        "Resp": {
            "video_id": 0
        }
    }
    ```
  - **사용자 선택지 필드** (프론트에서 선택박스 또는 입력으로 제공):
    - prompt: 텍스트 입력 (예: "transform into a puppy").
    - model: 선택박스 (Model version: v3.5, v4, v4.5, v5).
    - duration: 선택박스 (5, 8).
    - quality: 선택박스 (Video quality: "360p"(Turbo), "540p", "720p", "1080p").
    - motion_mode: 선택박스 (Motion mode: normal, fast; --fast only available when duration=5; --quality=1080p does not support fast; not supports on v5).
  - **디폴트 값**:
    - model: "v5"
    - duration: 5
    - quality: "720p"
    - motion_mode: "normal"
  - **파라미터**: Authorization: API-KEY, JSON 바디에 first_frame_img (First img_id), last_frame_img (Last img_id), 기타 옵션.
  - **구현 팁**: 생성 버튼 클릭 시 백엔드에서 호출. video_id를 히스토리에 저장. 선택지 필드는 UI에서 디폴트로 설정.

- **단계 3: 상태 폴링 (Get Video Generation Status API)**
  - **목적**: 생성 상태를 주기적으로 확인하여 완료 시 결과를 가져옵니다.
  - **API 엔드포인트**: GET https://app-api.pixverse.ai/openapi/v2/video/result/{video_id}.
  - **curl 요청 예시**:
    ```
    curl --location --request GET 'https://app-api.pixverse.ai/openapi/v2/video/result/' \
    --header 'API-KEY: your-api-key' \
    --header 'Ai-trace-id: {{$string.uuid}}'
    ```
  - **응답 예시**:
    ```
    {
        "ErrCode": 0,
        "ErrMsg": "string",
        "Resp": {
            "create_time": "string",
            "id": 0,
            "modify_time": "string",
            "negative_prompt": "string",
            "outputHeight": 0,
            "outputWidth": 0,
            "prompt": "string",
            "resolution_ratio": 0,
            "seed": 0,
            "size": 0,
            "status": 0,
            "style": "string",
            "url": "string"
        }
    }
    ```
  - **파라미터**: Authorization: API-KEY, URL에 video_id 포함.
  - **구현 팁**: 프론트에서 setInterval (예: 5초 간격)로 백엔드 폴링 API 호출. status=완료 시 url로 영상 표시/저장. 에러 처리 포함.

- **전체 흐름 요약**:
  1. 사용자: First/Last 이미지 업로드 → 생성 요청 (선택지 입력).
  2. 백엔드: Upload API → Transition API (video_id 획득).
  3. 프론트: 폴링로 Status API 호출 → 완료 시 영상 표시/저장.
- **주의사항**: API 응답 필드 변동성(대소문자) 처리, rate limit과 비용 확인. 에러 핸들링: 무효 키나 실패 시 알림 표시.

이 정리된 계획과 API 예시를 바탕으로 개발을 진행하면 기존 구조와 잘 통합될 것입니다. 추가 세부 사항이 필요하시면 알려주세요.