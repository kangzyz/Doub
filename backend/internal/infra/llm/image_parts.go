package llm

// collectImageInputParts 收集消息中可发送给图片编辑类协议的原始图片输入。
func collectImageInputParts(messages []Message) []ContentPart {
	images := make([]ContentPart, 0)
	for _, msg := range messages {
		for _, part := range msg.Parts {
			if part.Kind != ContentPartImage || len(part.Data) == 0 {
				continue
			}
			images = append(images, part)
		}
	}
	return images
}

// collectVideoInputParts 收集消息中可发送给视频编辑/延长协议的原始视频输入。
func collectVideoInputParts(messages []Message) []ContentPart {
	videos := make([]ContentPart, 0)
	for _, msg := range messages {
		for _, part := range msg.Parts {
			if part.Kind != ContentPartVideo || len(part.Data) == 0 {
				continue
			}
			videos = append(videos, part)
		}
	}
	return videos
}
