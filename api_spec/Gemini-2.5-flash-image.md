Gemini-2.5-flash-image

1. 이 api들은 PIAPI Key (기존 hailou영상생성에 사용한)를 사용해 헤더키를 채우면 됨
2. 사용자에겐 nanobanana 이미지 생성이라고 제공할 생각이고. 모델 이름은 gemini
3. 기존 hailou와 상단 키는 공유하나, 생성 자체는 별도 영역을 추가해서 만들어야 할듯.

고민 사항 : 생성시의 히스토리나, 저장한 생성물 제공을 기존 hailou와 같이 묶어야할지, nanobanana만 따로 관리할지.

api 목록

nanobanana (gemini-2.5-flash-image) 로 새로운 이미지 생성을 위한 api 
'''
POST
https://api.piapi.ai/api/v1/task

description

This is provided as Gemini flash image API. available models:
gemini-2.5-flash-image

Pricing
$0.03 per image

Request

Header Params
X-API-Key
string 
required
Your API KEY used for request authorization

Body Params
application/json

model
enum<string> 
required
the model name, should be 'gemini'
Value:
gemini

task_type
enum<string> 
required
the task_type, currently only supports 'gemini-2.5-flash-image'
Value:
gemini-2.5-flash-image

input
object 
required
the input param of the flux task

    prompt
    string 
    required
    The prompt for image editing.

    image_urls
    array[string]
    optional
    List of URLs of input images for editing.

    output_format
    enum<string> 
    optional
    Format of output image
    Allowed values:
    jpeg
    png
    Default:
    jpeg

    aspect_ratio
    enum<string> 
    optional
    Aspect of output image. t2i default is "1:1", i2i default is None(use input image ar)
    Allowed values:
    21:9
    1:1
    4:3
    3:2
    2:3
    5:4
    4:5
    3:4
    16:9
    9:16

config
object 
optional

    webhook_config
    object 
    optional
    Webhook provides timely task notifications. Check PiAPI webhook for detail.

    service_mode
    enum<string> 
    optional
    This allows users to choose whether this specific task will get processed under PAYG or HYA mode. If unspecified, then this task will get processed under whatever mode (PAYG or HYA)
    the user chose on the workspace setting of your account.
    public means this task will be processed under PAYG mode.
    private means this task will be processed under HYA mode.
    Allowed values:
    public
    means this task will be processed under PAYG mode.
    private
    means this task will be processed under HYA modesetting of your account.


request body example

{
    "model": "gemini",
    "task_type": "gemini-2.5-flash-image",
    "input": {
        "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater.",
        "output_format": "png",
        "aspect_ratio": "16:9"
    },
    "config": {
        "webhook_config": {
            "endpoint": "https://webhook.site/2f771461-14e0-4e15-b060-9ab7884cbc4f",
            "secret": ""
        }
    }
}

request curl sample

curl --location --request POST 'https://api.piapi.ai/api/v1/task' \
--header 'X-API-Key;' \
--header 'Content-Type: application/json' \
--data-raw '{
    "model": "gemini",
    "task_type": "gemini-2.5-flash-image",
    "input": {
        "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it'\''s mouth, and it'\''s paws paddling underwater.",
        "output_format": "png",
        "aspect_ratio": "16:9"
    },
    "config": {
        "webhook_config": {
            "endpoint": "https://webhook.site/2f771461-14e0-4e15-b060-9ab7884cbc4f",
            "secret": ""
        }
    }
}'

response 200 

{
    "code": 200,
    "data": {
        "task_id": "050e7489-ad71-4270-ad13-afdfec0d75ba",
        "model": "gemini",
        "task_type": "gemini-2.5-flash-image",
        "status": "pending",
        "config": {
            "service_mode": "",
            "webhook_config": {
                "endpoint": "https://webhook.site/2f771461-14e0-4e15-b060-9ab7884cbc4f",
                "secret": ""
            }
        },
        "input": {
            "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater.",
            "aspect_ratio": "16:9",
            "output_format": "png"
        },
        "output": null,
        "meta": {
            "created_at": "2025-10-18T01:45:37.318778184Z",
            "started_at": "0001-01-01T00:00:00Z",
            "ended_at": "0001-01-01T00:00:00Z",
            "usage": {
                "type": "llm",
                "frozen": 0,
                "consume": 300000
            },
            "is_using_private_pool": false
        },
        "detail": null,
        "logs": [],
        "error": {
            "code": 0,
            "raw_message": "",
            "message": "",
            "detail": null
        }
    },
    "message": "success"
}

response 200 description

code
integer 
required
data
object 
required
task_id
string 
required
model
string 
required
task_type
string 
required
status
enum<string> 
required
Hover on the "Completed" option and you coult see the explaintion of all status: completed/processing/pending/failed/staged
Allowed values:
Completed
Processing
Means that your jobs is currently being processed. Number of "processing" jobs counts as part of the "concurrent jobs"
Pending
Means that we recognizes the jobs you sent should be processed by MJ/Luma/Suno/Kling/etc but right now none of the account is available to receive further jobs. During peak loads there can be longer wait time to get your jobs from "pending" to "processing". If reducing waiting time is your primary concern, then a combination of Pay-as-you-go and Host-your-own-account option might suit you better.Number of "pending" jobs counts as part of the "concurrent jobs"
Failed
Task failed. Check the error message for detail.
Staged
A stage only in Midjourney task . Means that you have exceeded the number of your "concurrent jobs" limit and your jobs are being queuedNumber of "staged" jobs does not count as part of the "concurrent jobs". Also, please note the maximum number of jobs in the "staged" queue is 50. So if your operational needs exceed the 50 jobs limit, then please create your own queuing system logic.
input
object 
required
output
object 
required
meta
object 
required
detail
null 
required
logs
array [object] 
required
error
object 
required
message
string 
required
If you get non-null error message, here are some steps you chould follow:
Check our common error message
Retry for several times
If you have retried for more than 3 times and still not work, file a ticket on Discord and our support will be with you soon.

'''

위 생성 후 get task

'''
GET
https://api.piapi.ai/api/v1/task/{task_id}

curl 예시

curl --location --request GET 'https://api.piapi.ai/api/v1/task/' \
--header 'x-api-key;'

200 response example

{
    "timestamp": 1760751955,
    "data": {
        "task_id": "050e7489-ad71-4270-ad13-afdfec0d75ba",
        "model": "gemini",
        "task_type": "gemini-2.5-flash-image",
        "status": "completed",
        "config": {
            "service_mode": "",
            "webhook_config": {
                "endpoint": "https://webhook.site/2f771461-14e0-4e15-b060-9ab7884cbc4f",
                "secret": ""
            }
        },
        "input": {
            "aspect_ratio": "16:9",
            "output_format": "png",
            "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater."
        },
        "output": {
            "image_urls": [
                "https://img.theapi.app/ephemeral/9069c7e0-2557-4c80-a1ba-26e2bf7bb5f4.png"
            ]
        },
        "meta": {
            "created_at": "2025-10-18T01:45:37.318778184Z",
            "started_at": "2025-10-18T01:45:37.878148525Z",
            "ended_at": "2025-10-18T01:45:55.435320261Z",
            "usage": {
                "type": "llm",
                "frozen": 0,
                "consume": 300000
            },
            "is_using_private_pool": false
        },
        "detail": null,
        "logs": [],
        "error": {
            "code": 0,
            "raw_message": "",
            "message": "",
            "detail": null
        }
    }
}

200 response description

code
integer 
required
data
object 
required
task_id
string 
required
important for retriving task result using Fetch API
task_type
string 
required
status
enum<string> 
required
Allowed values:
pending
the task is in wait queue of GoAPI
starting
the task is beginning to procceed
processing	
rendering the task
success
task finished
failed
task failed
retry
this usually happens if your image url is hard to download
task_info
object 
required
task_result
object 
required
message
string 
required
'''