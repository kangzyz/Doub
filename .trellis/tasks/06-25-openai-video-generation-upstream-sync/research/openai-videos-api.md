# OpenAI Videos API Research

## Sources

* OpenAI video generation guide: https://developers.openai.com/api/docs/guides/video-generation
* OpenAI create video API reference: https://developers.openai.com/api/reference/resources/videos/methods/create/

## Findings

* Video generation is asynchronous: create a video job, poll the video resource until a terminal status, then download content.
* Text-to-video can be created from a prompt-only request.
* Image-to-video uses an `input_reference` image as the first frame.
* `input_reference` accepts supported image input through official API fields; the implementation should use multipart upload when sending a local conversation file.
* Supported size values for this task are `720x1280`, `1280x720`, `1024x1792`, and `1792x1024`.
* Supported duration values for this task are `4`, `8`, and `12` seconds.
* Reference images should be JPEG, PNG, or WebP and should match the requested output size. The local implementation will create a temporary resized copy for the OpenAI request and leave the original file unchanged.
* Download should request MP4 video content using the official content endpoint with `variant=video`.

## Repo Mapping

* Add protocol/task routing under `backend/internal/application/channel`.
* Add adapter support under `backend/internal/infra/llm`.
* Add conversation video streaming endpoint under `backend/internal/transport/http/conversation`.
* Extend frontend chat submit routing under `frontend/features/chat`.
* Use existing file preview support for MP4 playback.
