package conversation

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kangzyz/Doub/backend/internal/application/channel"
	appupload "github.com/kangzyz/Doub/backend/internal/application/upload"
	model "github.com/kangzyz/Doub/backend/internal/domain/conversation"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
	"github.com/kangzyz/Doub/backend/internal/pkg/traceid"
	"github.com/kangzyz/Doub/backend/internal/shared/security"
	"go.uber.org/zap"
)

// MediaImageTaskType 表示媒体图片任务类型。
type MediaImageTaskType string

const (
	// MediaImageTaskGeneration 表示纯文本提示词生成图片任务。
	MediaImageTaskGeneration MediaImageTaskType = "image_generation"
	// MediaImageTaskEdit 表示基于输入图片的编辑任务。
	MediaImageTaskEdit MediaImageTaskType = "image_edit"
)

const maxMediaImageEditFiles = 16

// MediaImageInput 定义媒体图片任务的应用层入参。
type MediaImageInput struct {
	UserID                uint
	ConversationID        uint
	RequestID             string
	TaskType              MediaImageTaskType
	Prompt                string
	PlatformModelName     string
	Options               map[string]interface{}
	ClientRunID           string
	FileIDs               []string
	ParentMessagePublicID string
	SourceMessagePublicID string
	BranchReason          string
	OnEvent               func(eventType string, payload map[string]interface{}) error
}

// StreamMediaImage 执行图片生成任务并把结果保存为文件对象。
// 图片能力不复用聊天生成链路，只通过图片任务类型和图片协议路由。
func (s *Service) StreamMediaImage(ctx context.Context, input MediaImageInput) (*SendMessageResult, error) {
	if input.TaskType != MediaImageTaskGeneration && input.TaskType != MediaImageTaskEdit {
		return nil, ErrInvalidMediaGenerationTask
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return nil, ErrInvalidMediaGenerationTask
	}
	if input.TaskType == MediaImageTaskGeneration && len(input.FileIDs) > 0 {
		return nil, ErrInvalidMediaGenerationTask
	}
	if input.TaskType == MediaImageTaskEdit && len(input.FileIDs) == 0 {
		return nil, ErrInvalidMediaGenerationTask
	}
	if input.TaskType == MediaImageTaskEdit && len(input.FileIDs) > maxMediaImageEditFiles {
		return nil, ErrTooManyMessageFiles
	}
	if s.routeResolver == nil || s.llmClient == nil {
		return nil, ErrModelRouteNotConfigured
	}
	ctx = context.WithoutCancel(ctx)

	// clientRunID 是媒体任务的幂等键；重复提交不能继续创建 run 和消息。
	runID := normalizeRunID(input.ClientRunID)
	if runID == "" {
		runID = "run_" + normalizePublicID(uuid.NewString())
	}
	existingRuns, err := s.repo.ListConversationRunsByRunIDs(ctx, input.UserID, input.ConversationID, []string{runID})
	if err != nil {
		return nil, err
	}
	if len(existingRuns) > 0 {
		return nil, ErrDuplicateMessageGenerationRun
	}
	cancelCtx, cancel := context.WithCancel(ctx)
	ctx = cancelCtx
	s.generationStreams.register(ctx, runID, input.UserID, cancel)

	startedAt := time.Now()
	conversation, err := s.repo.GetConversationByUser(ctx, input.ConversationID, input.UserID)
	if err != nil {
		return nil, ErrConversationNotFound
	}

	platformModelName := strings.TrimSpace(input.PlatformModelName)
	if platformModelName == "" {
		platformModelName = strings.TrimSpace(conversation.Model)
	}
	if platformModelName == "" {
		return nil, ErrModelRouteNotConfigured
	}
	var editSourceFiles []mediaImageEditSourceFile
	var editSourceAttachments []AttachmentInput
	if input.TaskType == MediaImageTaskEdit {
		editSourceFiles, err = s.loadMediaImageEditSourceFiles(ctx, input.UserID, input.FileIDs)
		if err != nil {
			return nil, err
		}
		editSourceAttachments = mediaImageEditSourceAttachments(editSourceFiles)
	}
	imageTaskType := channel.TaskTypeImageGeneration
	imageProtocol := llm.AdapterOpenAIImageGenerations
	imageEndpoint := llm.EndpointImageGenerations
	if input.TaskType == MediaImageTaskEdit {
		imageTaskType = channel.TaskTypeImageEdit
		imageProtocol = llm.AdapterOpenAIImageEdits
		imageEndpoint = llm.EndpointImageEdits
	}
	route, err := s.routeResolver.ResolveRoute(ctx, channel.ResolveRouteInput{
		PlatformModelName: platformModelName,
		TaskType:          imageTaskType,
		UserID:            input.UserID,
		ConversationID:    input.ConversationID,
		RequestID:         strings.TrimSpace(input.RequestID),
	})
	if err != nil {
		return nil, ErrModelRouteNotConfigured
	}
	if !strings.EqualFold(route.Protocol, imageProtocol) {
		return nil, ErrInvalidMediaGenerationTask
	}
	// 图片任务会把会话当前模型更新为实际执行的图片模型；标题、标签等内部文本任务会单独回退到聊天模型。
	if strings.TrimSpace(conversation.Model) != strings.TrimSpace(route.PlatformModelName) {
		conversation.Model = strings.TrimSpace(route.PlatformModelName)
		conversation.Provider = inferProvider(conversation.Model)
		if err = s.repo.UpdateConversationModel(ctx, input.ConversationID, conversation.Model, conversation.Provider); err != nil {
			return nil, err
		}
	}

	normalizedBranchReason := normalizeBranchReason(input.BranchReason)
	branchState, err := s.resolveMessageBranch(ctx, input.ConversationID, input.UserID, input.ParentMessagePublicID, input.SourceMessagePublicID, normalizedBranchReason)
	if err != nil {
		return nil, err
	}

	run := &model.Run{
		RunID:              runID,
		RequestID:          strings.TrimSpace(input.RequestID),
		UserID:             input.UserID,
		ConversationID:     input.ConversationID,
		TaskType:           string(input.TaskType),
		Endpoint:           imageEndpoint,
		Provider:           strings.TrimSpace(conversation.Provider),
		ProviderProtocol:   route.Protocol,
		UpstreamID:         route.UpstreamID,
		UpstreamModelID:    route.UpstreamModelID,
		UpstreamName:       route.UpstreamName,
		RequestedModelName: platformModelName,
		PlatformModelName:  route.PlatformModelName,
		RoutedBindingCode:  route.BindingCode,
		ModelVendor:        route.ModelVendor,
		ModelIcon:          route.ModelIcon,
		UpstreamModelName:  route.UpstreamModel,
		Status:             "error",
		StartedAt:          startedAt,
	}
	var retErr error
	defer func() {
		endedAt := time.Now()
		run.EndedAt = &endedAt
		run.TotalLatencyMS = endedAt.Sub(startedAt).Milliseconds()
		if retErr == nil {
			run.Status = "success"
		} else {
			run.Status = "error"
			run.ErrorCode = classifyRunErrorCode(retErr)
			run.ErrorMessage = truncateError(messageErrorSummary(retErr), 255)
		}
		if err := s.repo.CreateConversationRun(context.WithoutCancel(ctx), run); err != nil && s.logger != nil {
			s.logger.Error("create_media_conversation_run_failed",
				zap.String("trace_id", traceid.FromContext(ctx)),
				zap.String("run_id", run.RunID),
				zap.Error(err),
			)
		}
	}()

	userMessage := &model.Message{
		ConversationID:  input.ConversationID,
		UserID:          input.UserID,
		PublicID:        normalizePublicID(uuid.NewString()),
		ParentMessageID: branchState.ParentMessageID,
		RunID:           runID,
		Role:            "user",
		ContentType:     "text",
		Content:         strings.TrimSpace(input.Prompt),
		BranchReason:    normalizedBranchReason,
		SourceMessageID: branchState.SourceMessageID,
		TokenUsage:      estimateTokens(input.Prompt),
		InputTokens:     estimateTokens(input.Prompt),
		Status:          "success",
		Attachments:     marshalAttachmentSnapshots(editSourceAttachments),
	}
	if err = s.repo.CreateMessage(ctx, userMessage); err != nil {
		retErr = err
		return nil, err
	}
	userMessage.ParentPublicID = branchState.ParentPublicID
	userMessage.SourcePublicID = branchState.SourcePublicID
	if len(editSourceAttachments) > 0 {
		if err = s.repo.CreateAttachments(ctx, mediaImageEditSourceAttachmentRows(input.ConversationID, userMessage.ID, input.UserID, editSourceAttachments, time.Now())); err != nil {
			retErr = err
			return nil, err
		}
	}

	assistantMessage := &model.Message{
		ConversationID:  input.ConversationID,
		UserID:          input.UserID,
		PublicID:        normalizePublicID(uuid.NewString()),
		ParentMessageID: &userMessage.ID,
		RunID:           runID,
		Role:            "assistant",
		ContentType:     "image",
		Content:         "",
		BranchReason:    normalizedBranchReason,
		Status:          "pending",
		Attachments:     "[]",
	}
	if err = s.repo.CreateMessage(ctx, assistantMessage); err != nil {
		retErr = err
		return nil, err
	}
	// 媒体任务同样产生用户消息和助手消息，计数语义与普通聊天保持一致。
	if err = s.repo.IncrementMessageCount(ctx, input.ConversationID, 2); err != nil {
		retErr = err
		return nil, err
	}
	emitMediaEvent(input.OnEvent, "queued", "image task queued")

	cfg := s.cfg.Snapshot()
	attributionReferer, attributionTitle := s.llmAttribution()
	routeConfig := llm.RouteConfig{
		Protocol:            route.Protocol,
		BaseURL:             route.BaseURL,
		APIKey:              route.APIKey,
		HeadersJSON:         route.HeadersJSON,
		ConnectTimeoutMS:    route.ConnectTimeoutMS,
		ReadTimeoutMS:       route.ReadTimeoutMS,
		StreamIdleTimeoutMS: route.StreamIdleTimeoutMS,
		Endpoint:            imageEndpoint,
		UpstreamModel:       route.UpstreamModel,
		AttributionReferer:  attributionReferer,
		AttributionTitle:    attributionTitle,
	}
	filteredOptions := filterModelOptions(input.Options, route.Protocol, modelOptionPolicyConfig{
		Mode:             cfg.ModelOptionPolicyMode,
		AllowedPathsJSON: cfg.ModelOptionAllowedPaths,
		DeniedPathsJSON:  cfg.ModelOptionDeniedPaths,
	})

	statusMessage := "generating image"
	if input.TaskType == MediaImageTaskEdit {
		statusMessage = "editing image"
	}
	emitMediaEvent(input.OnEvent, "running", statusMessage)
	generateInput := llm.GenerateInput{
		RequestID:      strings.TrimSpace(input.RequestID),
		ConversationID: input.ConversationID,
		Messages:       buildMediaImageLLMMessages(input.Prompt, editSourceFiles),
		Options:        filteredOptions,
	}
	var output *llm.GenerateOutput
	if input.TaskType == MediaImageTaskGeneration && llm.SupportsImageGenerationStream(routeConfig.Protocol, routeConfig.UpstreamModel) {
		output, err = s.llmClient.GenerateStream(ctx, routeConfig, generateInput, func(event llm.GenerateStreamEvent) error {
			if event.Usage != (llm.Usage{}) && input.OnEvent != nil {
				if streamErr := input.OnEvent("usage", map[string]interface{}{
					"input_tokens":       event.Usage.InputTokens,
					"output_tokens":      event.Usage.OutputTokens,
					"cache_read_tokens":  event.Usage.CacheReadTokens,
					"cache_write_tokens": event.Usage.CacheWriteTokens,
					"reasoning_tokens":   event.Usage.ReasoningTokens,
				}); streamErr != nil {
					return streamErr
				}
			}
			if event.GeneratedImage != nil && event.GeneratedImagePartial {
				return emitMediaImageDelta(input.OnEvent, event)
			}
			return nil
		})
	} else {
		output, err = s.llmClient.Generate(ctx, routeConfig, generateInput)
	}
	if err != nil {
		s.routeResolver.MarkRouteFailure(ctx, route, err)
		retErr = wrapUpstreamRequestError(err)
		_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
		return nil, retErr
	}
	s.routeResolver.MarkRouteSuccess(ctx, route)
	if output == nil || len(output.GeneratedImages) == 0 {
		retErr = ErrUpstreamEmptyResponse
		_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
		return nil, retErr
	}

	emitMediaEvent(input.OnEvent, "saving_artifact", "saving image")
	uploaded := make([]model.FileObject, 0, len(output.GeneratedImages))
	attachmentRows := make([]model.Attachment, 0, len(output.GeneratedImages))
	now := time.Now()
	for i, image := range output.GeneratedImages {
		data, mimeType, readErr := s.readGeneratedImage(ctx, image)
		if readErr != nil {
			retErr = readErr
			_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
			return nil, readErr
		}
		fileName := generatedImageFileName(route.PlatformModelName, now, i, len(output.GeneratedImages), mimeType)
		uploadResult, uploadErr := s.UploadFile(ctx, appupload.UploadFileInput{
			UserID:       input.UserID,
			Purpose:      "generated_image",
			FileName:     fileName,
			MimeType:     mimeType,
			DeclaredSize: int64(len(data)),
			Reader:       bytes.NewReader(data),
		})
		if uploadErr != nil {
			retErr = uploadErr
			_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
			return nil, uploadErr
		}
		file := uploadResult.File
		uploaded = append(uploaded, file)
		attachmentRows = append(attachmentRows, model.Attachment{
			ConversationID: input.ConversationID,
			MessageID:      assistantMessage.ID,
			UserID:         input.UserID,
			FileID:         file.FileID,
			Kind:           "image",
			FileName:       file.FileName,
			MimeType:       file.DetectedMIME,
			FileSize:       file.SizeBytes,
			SHA256:         file.SHA256,
			StoragePath:    file.StoragePath,
			Status:         "active",
			UploadedAt:     now,
		})
	}
	if err = s.repo.CreateAttachments(ctx, attachmentRows); err != nil {
		retErr = err
		return nil, err
	}

	usage := output.Usage
	userMessage.InputTokens = usage.InputTokens
	userMessage.CacheReadTokens = usage.CacheReadTokens
	userMessage.CacheWriteTokens = usage.CacheWriteTokens
	userMessage.TokenUsage = usage.InputTokens + usage.CacheReadTokens + usage.CacheWriteTokens
	if err = s.repo.UpdateMessageUsage(
		ctx,
		userMessage.ID,
		usage.InputTokens,
		0,
		usage.CacheReadTokens,
		usage.CacheWriteTokens,
		0,
	); err != nil {
		retErr = err
		return nil, err
	}

	content := generatedImageMarkdown(uploaded)
	latencyMS := time.Since(startedAt).Milliseconds()
	if err = s.repo.UpdateAssistantMessageCompletion(ctx, assistantMessage.ID, content, usage.OutputTokens, usage.ReasoningTokens, latencyMS, "success", "", ""); err != nil {
		retErr = err
		return nil, err
	}
	assistantMessage.Content = content
	assistantMessage.OutputTokens = usage.OutputTokens
	assistantMessage.ReasoningTokens = usage.ReasoningTokens
	assistantMessage.TokenUsage = assistantMessage.OutputTokens + assistantMessage.ReasoningTokens
	assistantMessage.LatencyMS = latencyMS
	assistantMessage.Status = "success"
	assistantMessage.Attachments = string(marshalAttachmentSnapshots(attachmentsFromFiles(uploaded)))
	run.InputTokens = usage.InputTokens
	run.OutputTokens = usage.OutputTokens
	run.CacheReadTokens = usage.CacheReadTokens
	run.CacheWriteTokens = usage.CacheWriteTokens
	run.ReasoningTokens = usage.ReasoningTokens
	// 图片会话首轮没有文本 assistant 回复，标题/标签只使用用户第一条气泡内容生成。
	s.maybeGenerateConversationMetadataAsync(*conversation, *userMessage, model.Message{})

	return &SendMessageResult{
		UserMessage:        *userMessage,
		AssistantMessage:   *assistantMessage,
		UpstreamID:         route.UpstreamID,
		UpstreamName:       route.UpstreamName,
		PlatformModelName:  route.PlatformModelName,
		RoutedBindingCode:  route.BindingCode,
		UpstreamModelName:  route.UpstreamModel,
		UpstreamProtocol:   route.Protocol,
		EffectiveOptions:   filteredOptions,
		UsageSpeed:         usage.Speed,
		UsageServiceTier:   usage.ServiceTier,
		CacheWrite5mTokens: usage.CacheWrite5mTokens,
		CacheWrite1hTokens: usage.CacheWrite1hTokens,
		LatencyMS:          latencyMS,
	}, nil
}

// emitMediaEvent 输出媒体任务状态事件；失败不影响主流程。
func emitMediaEvent(onEvent func(string, map[string]interface{}) error, status string, message string) {
	if onEvent == nil {
		return
	}
	_ = onEvent("media_status", map[string]interface{}{
		"status":  status,
		"message": message,
	})
}

func emitMediaImageDelta(onEvent func(string, map[string]interface{}) error, event llm.GenerateStreamEvent) error {
	if onEvent == nil || event.GeneratedImage == nil {
		return nil
	}
	image := event.GeneratedImage
	if strings.TrimSpace(image.B64JSON) == "" {
		return nil
	}
	return onEvent("media_image_delta", map[string]interface{}{
		"index":          event.GeneratedImageIndex,
		"b64_json":       image.B64JSON,
		"mime_type":      strings.TrimSpace(image.MIMEType),
		"revised_prompt": strings.TrimSpace(image.RevisedPrompt),
	})
}

// readGeneratedImage 读取上游图片结果，并统一校验为可保存的图片字节。
// 上游临时 URL 只用于服务端下载，最终不会直接写入消息内容，避免长期依赖外部地址。
func (s *Service) readGeneratedImage(ctx context.Context, image llm.GeneratedImage) ([]byte, string, error) {
	mimeType := strings.TrimSpace(image.MIMEType)
	if mimeType == "" {
		mimeType = "image/png"
	}
	if b64 := strings.TrimSpace(image.B64JSON); b64 != "" {
		data, err := base64.StdEncoding.DecodeString(stripBase64DataURLPrefix(b64))
		if err != nil {
			return nil, mimeType, err
		}
		return validateGeneratedImageBytes(data, mimeType)
	}
	url := strings.TrimSpace(image.URL)
	if url == "" {
		return nil, mimeType, ErrUpstreamEmptyResponse
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, mimeType, err
	}
	cfg := s.cfg.Snapshot()
	client := security.NewOutboundHTTPClient(cfg.Env, cfg.SSRFProtectionEnabled, 60*time.Second)
	resp, err := client.Do(req)
	if err != nil {
		return nil, mimeType, err
	}
	defer resp.Body.Close() //nolint:errcheck
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, mimeType, fmt.Errorf("download generated image failed: HTTP %d", resp.StatusCode)
	}
	if contentType := strings.TrimSpace(resp.Header.Get("Content-Type")); strings.HasPrefix(strings.ToLower(contentType), "image/") {
		mimeType = strings.Split(contentType, ";")[0]
	}
	limit := s.cfg.Snapshot().MaxUploadFileBytes
	if limit <= 0 {
		limit = 20 * 1024 * 1024
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, mimeType, err
	}
	if int64(len(data)) > limit {
		return nil, mimeType, ErrFileTooLarge
	}
	return validateGeneratedImageBytes(data, mimeType)
}

// stripBase64DataURLPrefix 兼容 data URL 和纯 base64 两种上游返回格式。
func stripBase64DataURLPrefix(value string) string {
	normalized := strings.TrimSpace(value)
	if !strings.HasPrefix(strings.ToLower(normalized), "data:") {
		return normalized
	}
	if index := strings.Index(normalized, ","); index >= 0 {
		return strings.TrimSpace(normalized[index+1:])
	}
	return normalized
}

// validateGeneratedImageBytes 使用文件头重新识别 MIME，防止把非图片响应保存成图片文件。
func validateGeneratedImageBytes(data []byte, declaredMIME string) ([]byte, string, error) {
	detected := detectGeneratedImageMIME(data)
	if detected == "" {
		return nil, strings.TrimSpace(declaredMIME), fmt.Errorf("generated image content is not a supported image")
	}
	return data, detected, nil
}

// detectGeneratedImageMIME 识别当前支持落库的图片格式。
func detectGeneratedImageMIME(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	if len(data) >= 8 && bytes.Equal(data[:8], []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}) {
		return "image/png"
	}
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return "image/jpeg"
	}
	if len(data) >= 12 && bytes.Equal(data[:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")) {
		return "image/webp"
	}
	if len(data) >= 6 && (bytes.Equal(data[:6], []byte("GIF87a")) || bytes.Equal(data[:6], []byte("GIF89a"))) {
		return "image/gif"
	}
	return ""
}

// imageFileExtension 根据最终识别出的 MIME 决定生成文件扩展名。
func imageFileExtension(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
}

// generatedImageFileName 使用模型名和生成时间构造稳定可读的文件名。
func generatedImageFileName(modelName string, capturedAt time.Time, index int, total int, mimeType string) string {
	base := sanitizeGeneratedImageFileBase(modelName)
	timestamp := fmt.Sprintf("%s-%03d", capturedAt.Format("20060102-150405"), capturedAt.Nanosecond()/int(time.Millisecond))
	if total > 1 {
		return fmt.Sprintf("%s-%s-%02d%s", base, timestamp, index+1, imageFileExtension(mimeType))
	}
	return fmt.Sprintf("%s-%s%s", base, timestamp, imageFileExtension(mimeType))
}

// sanitizeGeneratedImageFileBase 清理模型名，确保生成文件名不含路径分隔符或不可控字符。
func sanitizeGeneratedImageFileBase(value string) string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return "image"
	}
	var builder strings.Builder
	builder.Grow(len(normalized))
	lastDash := false
	for _, item := range normalized {
		allowed := (item >= 'a' && item <= 'z') ||
			(item >= 'A' && item <= 'Z') ||
			(item >= '0' && item <= '9') ||
			item == '.' ||
			item == '_' ||
			item == '-'
		if allowed {
			builder.WriteRune(item)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	result := strings.Trim(builder.String(), ".-_")
	if result == "" {
		return "image"
	}
	if len(result) > 80 {
		result = strings.Trim(result[:80], ".-_")
	}
	if result == "" {
		return "image"
	}
	return result
}

// generatedImageMarkdown 将已保存的文件对象转换为受保护文件接口的 markdown 引用。
func generatedImageMarkdown(files []model.FileObject) string {
	blocks := make([]string, 0, len(files))
	for i, file := range files {
		alt := "Generated image"
		if len(files) > 1 {
			alt = fmt.Sprintf("Generated image %d", i+1)
		}
		blocks = append(blocks, fmt.Sprintf("![%s](/api/v1/files/%s/content)", alt, file.FileID))
	}
	return strings.Join(blocks, "\n\n")
}

// attachmentsFromFiles 生成消息附件快照，供流式完成事件立即返回给前端。
func attachmentsFromFiles(files []model.FileObject) []AttachmentInput {
	items := make([]AttachmentInput, 0, len(files))
	for _, file := range files {
		items = append(items, AttachmentInput{
			FileObjID:        file.ID,
			FileID:           file.FileID,
			Kind:             "image",
			FileName:         file.FileName,
			MimeType:         file.MimeType,
			DetectedMIME:     file.DetectedMIME,
			FileCategory:     file.FileCategory,
			FileSize:         file.SizeBytes,
			SHA256:           file.SHA256,
			StoragePath:      file.StoragePath,
			ProcessingStatus: file.ProcessingStatus,
			ProcessingReady:  file.ProcessingReady,
		})
	}
	return items
}

type mediaImageEditSourceFile struct {
	Attachment AttachmentInput
	Data       []byte
	MimeType   string
}

func (s *Service) loadMediaImageEditSourceFiles(ctx context.Context, userID uint, fileIDs []string) ([]mediaImageEditSourceFile, error) {
	attachments, err := s.resolveAttachments(ctx, userID, fileIDs)
	if err != nil {
		return nil, err
	}
	if len(attachments) == 0 {
		return nil, ErrInvalidMediaGenerationTask
	}
	if s.storeProvider == nil {
		return nil, ErrInvalidFileReference
	}
	store, err := s.storeProvider.Open(ctx)
	if err != nil {
		return nil, err
	}
	cfg := s.cfg.Snapshot()
	limit := minPositiveInt64(cfg.MaxUploadFileBytes, cfg.FileImageMaxBytes)
	if limit <= 0 {
		limit = 20 * 1024 * 1024
	}

	files := make([]mediaImageEditSourceFile, 0, len(attachments))
	for _, attachment := range attachments {
		declaredMIME := normalizeMIMEValue(firstNonEmptyString(attachment.DetectedMIME, attachment.MimeType))
		if attachment.FileCategory != fileCategoryImage || !strings.HasPrefix(declaredMIME, "image/") {
			return nil, ErrInvalidFileReference
		}
		if strings.TrimSpace(attachment.StoragePath) == "" {
			return nil, ErrInvalidFileReference
		}
		reader, _, openErr := store.Open(ctx, strings.TrimSpace(attachment.StoragePath))
		if openErr != nil {
			return nil, ErrInvalidFileReference
		}
		data, readErr := io.ReadAll(io.LimitReader(reader, limit+1))
		closeErr := reader.Close()
		if readErr != nil {
			return nil, readErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		if int64(len(data)) > limit {
			return nil, ErrFileTooLarge
		}
		detectedMIME := detectGeneratedImageMIME(data)
		if !isSupportedMediaImageEditMIME(detectedMIME) {
			return nil, ErrMIMEBlocked
		}
		attachment.Kind = "image"
		attachment.MimeType = detectedMIME
		attachment.DetectedMIME = detectedMIME
		attachment.FileCategory = fileCategoryImage
		attachment.FileSize = int64(len(data))
		files = append(files, mediaImageEditSourceFile{
			Attachment: attachment,
			Data:       data,
			MimeType:   detectedMIME,
		})
	}
	return files, nil
}

func isSupportedMediaImageEditMIME(mimeType string) bool {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/png", "image/jpeg", "image/jpg", "image/webp":
		return true
	default:
		return false
	}
}

func mediaImageEditSourceAttachments(files []mediaImageEditSourceFile) []AttachmentInput {
	items := make([]AttachmentInput, 0, len(files))
	for _, file := range files {
		item := file.Attachment
		item.Kind = "image"
		item.MimeType = file.MimeType
		item.DetectedMIME = file.MimeType
		item.FileCategory = fileCategoryImage
		item.FileSize = int64(len(file.Data))
		items = append(items, item)
	}
	return items
}

func mediaImageEditSourceAttachmentRows(
	conversationID uint,
	messageID uint,
	userID uint,
	attachments []AttachmentInput,
	uploadedAt time.Time,
) []model.Attachment {
	rows := make([]model.Attachment, 0, len(attachments))
	for _, item := range attachments {
		rows = append(rows, model.Attachment{
			ConversationID: conversationID,
			MessageID:      messageID,
			UserID:         userID,
			FileID:         strings.TrimSpace(item.FileID),
			Kind:           normalizeAttachmentKind(item.Kind, item.MimeType),
			FileName:       strings.TrimSpace(item.FileName),
			MimeType:       strings.TrimSpace(firstNonEmptyString(item.DetectedMIME, item.MimeType)),
			FileSize:       item.FileSize,
			SHA256:         strings.TrimSpace(item.SHA256),
			StoragePath:    strings.TrimSpace(item.StoragePath),
			Status:         "active",
			MetaJSON:       strings.TrimSpace(item.MetaJSON),
			UploadedAt:     uploadedAt,
		})
	}
	return rows
}

func buildMediaImageLLMMessages(prompt string, sourceFiles []mediaImageEditSourceFile) []llm.Message {
	normalizedPrompt := strings.TrimSpace(prompt)
	if len(sourceFiles) == 0 {
		return []llm.Message{{
			Role:    "user",
			Content: normalizedPrompt,
		}}
	}
	parts := make([]llm.ContentPart, 0, len(sourceFiles)+1)
	parts = append(parts, llm.ContentPart{
		Kind: llm.ContentPartText,
		Text: normalizedPrompt,
	})
	for _, file := range sourceFiles {
		parts = append(parts, llm.ContentPart{
			Kind:     llm.ContentPartImage,
			MimeType: file.MimeType,
			Data:     file.Data,
			FileName: file.Attachment.FileName,
		})
	}
	return []llm.Message{{
		Role:    "user",
		Content: normalizedPrompt,
		Parts:   parts,
	}}
}
