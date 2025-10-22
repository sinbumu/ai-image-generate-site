miji 서비스의 템플릿과 프레임을 생성-제거 하기 위한 어드민 api들에 대한 스팩 설명
1. 해당 api는 ip제한을 걸어서 관리 사무실에서만 호출 가능하게 하고. 현재 보안인증은 미구현
2. 프레임과 스타일의 관계는, 프레임이 더 상위개념으로 존재하고, 스타일이 프레임 하위 집합으로 존재.
3. 새로 만들시엔 우선 프레임을 새로 추가하고, 해당 프레임에 스타일들을 추가하는 방식.
4. 프레임을 삭제하면 포함된 스타일도 전부 제거됨.
5. 이 기능은 lab.cccv.to/template 이렇게 /template 패스로 접근했을때 제공할 계획
6. 기본적으로 Get API로 현재 존재하는 모든 프레임-스타일 데이터를 가져온뒤, 해당 어드민 페이지에서 정렬해서 보여줄 생각.
7. 새로운 프레임 생성, 새로운 스타일 생성 시에는 각각 버튼을 누르면 모달창이 뜨고, 모달창에 필수 입력사항들 기입후 컨펌하면 생성하게 할 생각
8. 기존 스타일을 수정하고 싶을 경우에는... 개인적으로 리스트에서 클릭시 수정이 되면 편하겠지만. 일단은 기존 스타일 수정 버튼을 누르고, 거기다 스타일 이름을 입력할경우, 전체조회 요청을 해서, 해당 스타일이 있나 찾고 있으면 그 데이터를 인풋에 채우고 수정하는 식으로.

고민사항
1. 어떤식으로 구현해야 사용자가 새로운 프레임과 스타일을 편하게 추가/수정 가능할까?
2. 어드민에서 일차적으로는 'GET /v1/api/photo-card/template/admin/ai-frame-template'을 호출해서 모든 프레임-스타일 데이터를 가져오기로 했는데 이거를 웹사이트에서 정렬이나 필터로 볼 수 있게 만드는거 쉽게 가능?
3. dev에서 작업한 프레임-스타일에 대해서 웹페이지에서 임시로(새로고침하면 사라져도 됨) 스냅샷을 뜬 뒤에, prod에 해당 스냅샷을 추가할 수 있는 기능 같은거 있으면 편할텐데 쉽게 될까

API 서버 주소

dev api : https://prod-dev.cccv.to

prod api : https://prod-renewal-cccv.cccv.to

API 목록

'''
DELETE /v1/api/photo-card/template/admin/ai-frame-template
프레임 탬플릿 삭제

req body

{
  "frameName": "string"
}

res 200

nobody

res 503

{
  "errorCode": "string",
  "httpStatus": 0,
  "message": "string",
  "timeStamp": "2025-10-17T09:29:51.041Z",
  "uuid": "string"
}
'''

'''
GET /v1/api/photo-card/template/admin/ai-frame-template
프레임 탬플릿 조회 (하위 스타일까지 전부 가져오고, 어드민용 전체 조회 api)

req body

nobody

res 200

{
  "data": [
    {
      "available": true,
      "createdAt": "2025-10-20T09:18:57.352Z",
      "dbId": "string",
      "event": true,
      "id": "string",
      "keyword": [
        "string"
      ],
      "lockVersion": 0,
      "name": "string",
      "order": 0,
      "sampleImageUrl": "string",
      "schemaVersion": "string",
      "styleList": [
        {
          "backImageUrl": "string",
          "backgroundImageUrl": "string",
          "displayPrompt": "string",
          "imageUploadInfoType": "DEFAULT",
          "name": "string",
          "order": 0,
          "styleImageUrl": "string",
          "styleVideoUrl": "string",
          "prompt":"string",
          "displayPrompt":"string",
          "imageUploadInfoType": "string",
          "order": 0,
          "styleType": "string",
          "prompt": [
            string
          ],
        }
      ],
      "updatedAt": "2025-10-20T09:18:57.352Z"
    }
  ]
}

res 200 field 구조

AiFrameTemplateAdminRetrieveResponseDto{
data*	[AiFrameTemplate{
available*	boolean
createdAt	string($date-time)
dbId*	string
event*	boolean
id	string
keyword*	[string]
lockVersion*	integer($int64)
name*	string
order*	integer($int32)
sampleImageUrl*	string
schemaVersion*	string
styleList*	[TemplateStyle{
backImageUrl*	string
backgroundImageUrl*	string
displayPrompt	string
imageUploadInfoType*	string
Enum:
[ DEFAULT, PIXEL ]
name*	string
order	integer($int32)
styleImageUrl*	string
styleVideoUrl*	string
}]
updatedAt	string($date-time)
}]
}

res 503

{
  "errorCode": "string",
  "httpStatus": 0,
  "message": "string",
  "timeStamp": "2025-10-17T09:31:05.401Z",
  "uuid": "string"
}
'''

'''
POST /v1/api/photo-card/template/admin/ai-frame-template
AI 프레임 템플릿 생성

req body

{
  "event": false,
  "frameName": "string",
  "order": 0,
  "sampleImageUrl": "string"
}

req body description

AiFrameTemplateCreateRequestDto{
event*	boolean
example: false
default: false
event 용인지 설정

frameName*	string
order*	integer($int32)
sampleImageUrl*	string
}

res 200

{
  "id": "string"
}

res 503

{
  "errorCode": "string",
  "httpStatus": 0,
  "message": "string",
  "timeStamp": "2025-10-17T09:39:21.632Z",
  "uuid": "string"
}
'''

'''
DELETE /v1/api/photo-card/template/admin/ai-frame-template/style
스타일 삭제

req body

{
  "frameName": "string", //Frame의 이름
  "styleName": "string" //style의 이름
}

res 200

nobody

res 503

{
  "errorCode": "string",
  "httpStatus": 0,
  "message": "string",
  "timeStamp": "2025-10-17T09:29:51.041Z",
  "uuid": "string"
}
'''

'''
POST /v1/api/photo-card/template/admin/ai-frame-template/style
AI 프레임 템플릿에 포토카드 스타일 추가 또는 업데이트

req body

{
  "displayPrompt": "string",
  "frameName": "string",
  "gptPromptList": [
    {
      "name": "string",
      "prompt": "string"
    }
  ],
  "gptSampleImageUrlList": [
    {
      "imageUrl": [
        "string"
      ],
      "name": "string",
      "sampleCount": 0
    }
  ],
  "hailuoPromptList": [
    {
      "name": "string",
      "prompt": "string"
    }
  ],
  "imageUploadInfoType": "DEFAULT",
  "order": 0,
  "prompt": [
    "string"
  ],
  "styleImageUrl": "string",
  "styleName": "string",
  "styleType": "GPT_HAILUO",
  "styleVideoUrl": "string"
}

req body description

TemplateStyleUpsertRequestDto{
displayPrompt	string
노출용 프롬프트

frameName*	string
프레임 이름

gptPromptList	[
GPT_HAILUO, 생일축하 - 픽셀미니미 참고, name 이 있을 경우, 동일한 name의 다른 셋트를 고정 선택함

GptPromptDto{
description:	
GPT_HAILUO, 생일축하 - 픽셀미니미 참고, name 이 있을 경우, 동일한 name의 다른 셋트를 고정 선택함

name	string
prompt*	string
}]
gptSampleImageUrlList	[
GPT_HAILUO, 목록별로 sampleCount 만큼 샘플을 선택함

GptSampleImageDto{
description:	
GPT_HAILUO, 목록별로 sampleCount 만큼 샘플을 선택함

imageUrl*	[string]
name	string
sampleCount*	integer($int32)
}]
hailuoPromptList	[
GPT_HAILUO

HailuoPromptDto{
description:	
GPT_HAILUO

name	string
prompt*	string
}]
imageUploadInfoType*	string
이미지 업로드 안내 문구 타입 지정

Enum:
[ DEFAULT, PIXEL ]
order	integer($int32)
prompt	[
PIXVERSE, PIXVERSE_IMAGE_TO_VIDEO, HAILUO_IMAGE_TO_VIDEO

string
PIXVERSE, PIXVERSE_IMAGE_TO_VIDEO, HAILUO_IMAGE_TO_VIDEO

]
styleImageUrl*	string
스타일 샘플 이미지

styleName*	string
스타일 이름

styleType*	string
스타일 종류

Enum:
[ GPT_HAILUO, PIXVERSE, PIXVERSE_IMAGE_TO_VIDEO, HAILUO_IMAGE_TO_VIDEO ]
styleVideoUrl*	string
스타일 샘플 비디오

}

res 200

{
  "id": "string"
}

res 503

{
  "errorCode": "string",
  "httpStatus": 0,
  "message": "string",
  "timeStamp": "2025-10-17T09:58:10.864Z",
  "uuid": "string"
}
'''

'''
POST /v1/util/r2/presign
사전에 서명된 R2 URL 생성

req body

{
  "bucketName": "dev-miji-photocard",
  "duration": 7,
  "key": "ai-generation/template/frame",
  "presignedUrlMethod": "PUT"
}

200 res body

{
  "url": "string"
}

503 res body

{
  "errorCode": "string",
  "httpStatus": 0,
  "message": "string",
  "timeStamp": "2025-10-17T10:08:10.929Z",
  "uuid": "string"
}
'''

---

주의사항 : 'POST /v1/api/photo-card/template/admin/ai-frame-template/style' 사용시

styleType 이 GPT_HAILUO 일때는 
gptPromptList
gptSampleImageUrlList
hailuoPromptList
3가지 필드를 채워야 함

최외곽 prompt 필드는 styleType이 PIXVERSE, PIXVERSE_IMAGE_TO_VIDEO 일때만 필요.

---
request field가 변하는 api들

POST  /v1/api/photo-card/template/admin/ai-frame-template
style -> frameName

DELETE  /v1/api/photo-card/template/admin/ai-frame-template
style -> frameName

DELETE  /v1/api/photo-card/template/admin/ai-frame-template/style
name -> frameName
style -> styleName

response field가 추가되거나 변하는 api
GET /v1/api/photo-card/template/admin/ai-frame-template
item에 styleType 필드값 추가.
---
request field가 변하는 api들 2

POST  /v1/api/photo-card/template/admin/ai-frame-template
+ order (필드 추가)

response field가 추가되거나 변하는 api
GET /v1/api/photo-card/template/admin/ai-frame-template
item에 styleList.styleType 필드값 추가.
item에 styleList.order 필드값 추가.

POST  /v1/api/photo-card/template/admin/ai-frame-template/style
order
---
api 변동사항 v3

POST  /v1/api/photo-card/template/admin/ai-frame-template/style
styleType enum 에 HAILUO_IMAGE_TO_VIDEO 값 추가됨. HAILUO_IMAGE_TO_VIDEO는 pixverse타입처럼 prompt만 필수 필드고 gptPromptList,gptSampleImageUrlList, hailuoPromptList등의 필드 사용하지 않음.
prompt : String -> List<String> //프롬프트 필드가 string 에서 List<String>로 바뀌었? 다는데 서버개발자가 자기 코드 기준인듯? 배열로 바뀌었다고 보면 될듯.

GET /v1/api/photo-card/template/admin/ai-frame-template
data.styleList.prompt : String -> List<String> 위 프롬프트 변경에 따라서 GET api도 바뀜.
