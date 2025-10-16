https://docs.platform.pixverse.ai/image-to-video-generation-13016633e0

curl 예시
```
curl --location --request POST 'https://app-api.pixverse.ai/openapi/v2/video/img/generate' \
--header 'API-KEY: your-api-key' \
--header 'Ai-trace-id: {{$string.uuid}}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "duration": 5,
    "img_id": 0,
    "model": "v4.5",
    "motion_mode": "normal",
    "negative_prompt": "string",
    //"camera_movement": "zoom_in", //Use this field to apply camera movement if needed.
    "prompt": "string",
    "quality": "540p",
    //"template_id": 302325299692608, //Use this field to apply template which you activated
    //"sound_effect_switch":true,
    //"sound_effect_content":"",
    //"lip_sync_tts_switch":true,
    //"lip_sync_tts_content":"",
    //"lip_sync_tts_speaker_id":"",
    "seed": 0
}'
```

응답 예시
```
{
    "ErrCode": 0,
    "ErrMsg": "string",
    "Resp": {
        "video_id": 0
    }
}
```

request body param 설명

Body Params
application/json

duration
integer 
required
Video duration (5, 8 seconds, --model=v3.5 only allows 5,8; --quality=1080p does not support 8s)
Example:
5

img_id
integer <uint64>
required
Image ID from Upload image API. single image or single-image templates

img_ids
array[integer]
optional
for multi-image templates. ex) "img_ids ":[0,0]

model
string 
required
Model version (now supports v3.5/v4/v4.5/v5)
Example:
v3.5

motion_mode
string 
optional
Motion mode (normal, fast, --fast only available when duration=5; --quality=1080p does not support fast) , not supports on v5
Default:
normal
Example:
normal

negative_prompt
string 
optional
Negative prompt
<= 2048 characters

prompt
string 
required
Prompt
<= 2048 characters

quality
string 
required
Video quality ("360p"(Turbo), "540p", "720p", "1080p")
Example:
540p

seed
integer 
optional
Random seed, range: 0 - 2147483647

style
string 
optional
Style (effective when model=v3.5, "anime", "3d_animation", "clay", "comic", "cyberpunk") Do not include style parameter unless needed
Example:
anime

template_id
integer 
optional
Template ID (template_id must be activated before use)
Example:
302325299692608

sound_effect_switch
boolean 
optional
Set to true if you want to enable this feature. Default is false.

sound_effect_content
string 
optional
Sound effect content to generate. If not provided, a sound effect will be automatically generated based on the video content.

lip_sync_switch
boolean 
optional
Set to true if you want to enable this feature. Default is false.

lip_sync_tts_content
string 
optional
~140 (UTF-8) characters. If the generated audio exceeds the video duration, it will be truncated.

lip_sync_tts_speaker_id
string 
optional
id from Get speech tts list

