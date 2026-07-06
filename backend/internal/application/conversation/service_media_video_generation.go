package conversation

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kangzyz/Doub/backend/internal/application/channel"
	appupload "github.com/kangzyz/Doub/backend/internal/application/upload"
	model "github.com/kangzyz/Doub/backend/internal/domain/conversation"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
	"github.com/kangzyz/Doub/backend/internal/pkg/traceid"
	"github.com/kangzyz/Doub/backend/internal/repository"
	"go.uber.org/zap"
)

// MediaVideoInput 定义媒体视频任务的应用层入参。
type MediaVideoInput struct {
	UserID                uint
	ConversationID        uint
	RequestID             string
	Prompt                string
	PlatformModelName     string
	Options               map[string]interface{}
	ClientRunID           string
	FileIDs               []string
	InputReferenceFileID  string
	ParentMessagePublicID string
	SourceMessagePublicID string
	BranchReason          string
	OnEvent               func(eventType string, payload map[string]interface{}) error
}

// StreamMediaVideo 执行 OpenAI 视频生成任务并把结果保存为文件对象。
func (s *Service) StreamMediaVideo(ctx context.Context, input MediaVideoInput) (*SendMessageResult, error) {
	if strings.TrimSpace(input.Prompt) == "" {
		return nil, ErrMediaVideoPromptRequired
	}
	referenceFileIDs, err := normalizeMediaVideoReferenceFileIDs(input.FileIDs, input.InputReferenceFileID)
	if err != nil {
		return nil, ErrMediaVideoTooManyInputs
	}
	input.FileIDs = referenceFileIDs
	if s.routeResolver == nil || s.llmClient == nil {
		return nil, ErrModelRouteNotConfigured
	}
	ctx = context.WithoutCancel(ctx)

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

	route, err := s.routeResolver.ResolveRoute(ctx, channel.ResolveRouteInput{
		PlatformModelName: platformModelName,
		TaskType:          channel.TaskTypeVideoGeneration,
		UserID:            input.UserID,
		ConversationID:    input.ConversationID,
		RequestID:         strings.TrimSpace(input.RequestID),
	})
	if err != nil {
		return nil, ErrModelRouteNotConfigured
	}
	if !llm.IsVideoGenerationAdapter(route.Protocol) {
		return nil, ErrMediaRouteProtocolMismatch
	}
	if strings.TrimSpace(conversation.Model) != strings.TrimSpace(route.PlatformModelName) {
		conversation.Model = strings.TrimSpace(route.PlatformModelName)
		conversation.Provider = inferProvider(conversation.Model)
		if err = s.repo.UpdateConversationModel(ctx, input.ConversationID, conversation.Model, conversation.Provider); err != nil {
			return nil, err
		}
	}

	cfg := s.cfg.Snapshot()
	filteredOptions := filterModelOptions(input.Options, route.Protocol, modelOptionPolicyConfig{
		Mode:                       cfg.ModelOptionPolicyMode,
		AllowedPathsJSON:           cfg.ModelOptionAllowedPaths,
		DeniedPathsJSON:            cfg.ModelOptionDeniedPaths,
		NativeToolAllowedTypesJSON: cfg.NativeToolAllowedTypes,
		ModelCapabilitiesJSON:      route.ModelCapabilitiesJSON,
	})
	targetSize := mediaVideoTargetSize(filteredOptions)
	resolvedAttachments, referencePart, err := s.resolveMediaVideoReferenceInput(ctx, input, targetSize)
	if err != nil {
		return nil, err
	}

	normalizedBranchReason := normalizeBranchReason(input.BranchReason)
	branchState, err := s.resolveMessageBranch(ctx, input.ConversationID, input.UserID, input.ParentMessagePublicID, input.SourceMessagePublicID, normalizedBranchReason)
	if err != nil {
		return nil, err
	}
	attachmentsJSON := marshalAttachmentSnapshots(resolvedAttachments)

	run := &model.Run{
		RunID:              runID,
		RequestID:          strings.TrimSpace(input.RequestID),
		UserID:             input.UserID,
		ConversationID:     input.ConversationID,
		TaskType:           channel.TaskTypeVideoGeneration,
		Endpoint:           llm.EndpointVideoGenerations,
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
			s.logger.Error("create_media_video_conversation_run_failed",
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
		ContentType:     mediaVideoUserContentType(len(resolvedAttachments) > 0),
		Content:         strings.TrimSpace(input.Prompt),
		BranchReason:    normalizedBranchReason,
		SourceMessageID: branchState.SourceMessageID,
		TokenUsage:      estimateTokens(input.Prompt),
		InputTokens:     estimateTokens(input.Prompt),
		Status:          "success",
		Attachments:     attachmentsJSON,
	}
	userAttachmentRows := make([]model.Attachment, 0, len(resolvedAttachments))
	if len(resolvedAttachments) > 0 {
		now := time.Now()
		for _, item := range resolvedAttachments {
			userAttachmentRows = append(userAttachmentRows, model.Attachment{
				ConversationID: input.ConversationID,
				UserID:         input.UserID,
				FileID:         strings.TrimSpace(item.FileID),
				Kind:           normalizeAttachmentKind(item.Kind, item.MimeType),
				FileName:       strings.TrimSpace(item.FileName),
				MimeType:       strings.TrimSpace(item.MimeType),
				FileSize:       item.FileSize,
				SHA256:         strings.TrimSpace(item.SHA256),
				StoragePath:    strings.TrimSpace(item.StoragePath),
				Status:         "active",
				MetaJSON:       strings.TrimSpace(item.MetaJSON),
				UploadedAt:     now,
			})
		}
	}

	assistantMessage := &model.Message{
		ConversationID: input.ConversationID,
		UserID:         input.UserID,
		PublicID:       normalizePublicID(uuid.NewString()),
		RunID:          runID,
		Role:           "assistant",
		ContentType:    "video",
		Content:        "",
		BranchReason:   normalizedBranchReason,
		Status:         "pending",
		Attachments:    "[]",
	}
	if err = s.repo.CreateMessagePairWithUserAttachments(ctx, userMessage, assistantMessage, userAttachmentRows); err != nil {
		retErr = err
		return nil, err
	}
	userMessage.ParentPublicID = branchState.ParentPublicID
	userMessage.SourcePublicID = branchState.SourcePublicID
	assistantMessage.ParentPublicID = userMessage.PublicID
	traceRecorder := newMessageTraceRecorder(s, ctx, assistantMessage, input.OnEvent)
	defer func() {
		if retErr != nil && traceRecorder != nil {
			traceRecorder.fail(retErr)
			traceRecorder.attachToMessage(assistantMessage)
		}
	}()
	emitMediaEvent(input.OnEvent, "queued", "video task queued")

	attributionReferer, attributionTitle := s.llmAttribution()
	routeConfig := llm.RouteConfig{
		Protocol:            route.Protocol,
		BaseURL:             route.BaseURL,
		APIKey:              route.APIKey,
		HeadersJSON:         route.HeadersJSON,
		ConnectTimeoutMS:    route.ConnectTimeoutMS,
		ReadTimeoutMS:       route.ReadTimeoutMS,
		StreamIdleTimeoutMS: route.StreamIdleTimeoutMS,
		Endpoint:            llm.EndpointVideoGenerations,
		UpstreamModel:       route.UpstreamModel,
		ModelVendor:         route.ModelVendor,
		AttributionReferer:  attributionReferer,
		AttributionTitle:    attributionTitle,
	}

	referenceKind := ""
	if referencePart != nil {
		referenceKind = strings.TrimSpace(referencePart.Kind)
	}
	emitMediaEvent(input.OnEvent, "running", mediaVideoRunningMessage(referenceKind))
	generateInput := llm.GenerateInput{
		RequestID:      strings.TrimSpace(input.RequestID),
		ConversationID: input.ConversationID,
		Messages: []llm.Message{{
			Role:    "user",
			Content: strings.TrimSpace(input.Prompt),
		}},
		Options: filteredOptions,
	}
	if referencePart != nil {
		generateInput.Messages = []llm.Message{{
			Role: "user",
			Parts: []llm.ContentPart{
				{Kind: llm.ContentPartText, Text: strings.TrimSpace(input.Prompt)},
				*referencePart,
			},
		}}
	}
	if s.logger != nil {
		s.logger.Info("media_video_generation_request",
			zap.String("trace_id", traceid.FromContext(ctx)),
			zap.String("run_id", runID),
			zap.Uint("conversation_id", input.ConversationID),
			zap.String("platform_model", route.PlatformModelName),
			zap.String("upstream_model", route.UpstreamModel),
			zap.String("protocol", route.Protocol),
			zap.Int("reference_count", len(input.FileIDs)),
			zap.Bool("input_reference", referencePart != nil),
			zap.String("reference_kind", referenceKind),
			zap.String("target_size", targetSize),
		)
	}

	output, err := s.llmClient.Generate(ctx, routeConfig, generateInput)
	if err != nil {
		if s.logger != nil {
			s.logger.Warn("media_video_generation_failed",
				zap.String("trace_id", traceid.FromContext(ctx)),
				zap.String("run_id", runID),
				zap.String("platform_model", route.PlatformModelName),
				zap.String("upstream_model", route.UpstreamModel),
				zap.Bool("input_reference", referencePart != nil),
				zap.String("reference_kind", referenceKind),
				zap.Error(err),
			)
		}
		s.routeResolver.MarkRouteFailure(ctx, route, err)
		retErr = wrapUpstreamRequestError(err)
		_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
		return nil, retErr
	}
	s.routeResolver.MarkRouteSuccess(ctx, route)
	if output == nil || len(output.GeneratedVideos) == 0 {
		retErr = ErrUpstreamEmptyResponse
		_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
		return nil, retErr
	}

	emitMediaEvent(input.OnEvent, "saving_artifact", "saving video")
	uploaded := make([]model.FileObject, 0, len(output.GeneratedVideos))
	attachmentRows := make([]model.Attachment, 0, len(output.GeneratedVideos))
	now := time.Now()
	for i, video := range output.GeneratedVideos {
		data, mimeType, readErr := validateGeneratedVideoBytes(video.Data, video.MIMEType)
		if readErr != nil {
			retErr = readErr
			_ = s.repo.UpdateMessageState(ctx, assistantMessage.ID, "error", classifyRunErrorCode(retErr), truncateError(messageErrorSummary(retErr), 255))
			return nil, readErr
		}
		fileName := generatedVideoFileName(route.PlatformModelName, now, i, len(output.GeneratedVideos), mimeType)
		uploadResult, uploadErr := s.UploadFile(ctx, appupload.UploadFileInput{
			UserID:       input.UserID,
			Purpose:      "generated_video",
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
			Kind:           "video",
			FileName:       file.FileName,
			MimeType:       file.DetectedMIME,
			FileSize:       file.SizeBytes,
			SHA256:         file.SHA256,
			StoragePath:    file.StoragePath,
			Status:         "active",
			UploadedAt:     now,
		})
	}

	usage := output.Usage
	userMessage.InputTokens = usage.InputTokens
	userMessage.CacheReadTokens = usage.CacheReadTokens
	userMessage.CacheWriteTokens = usage.CacheWriteTokens
	userMessage.TokenUsage = usage.InputTokens + usage.CacheReadTokens + usage.CacheWriteTokens

	content := generatedVideoMarkdown(uploaded)
	latencyMS := time.Since(startedAt).Milliseconds()
	if err = s.repo.CompleteAssistantMessageWithAttachments(ctx,
		userMessage.ID,
		repository.MessageUsageUpdate{
			InputTokens:      usage.InputTokens,
			CacheReadTokens:  usage.CacheReadTokens,
			CacheWriteTokens: usage.CacheWriteTokens,
		},
		assistantMessage.ID,
		repository.AssistantMessageCompletionUpdate{
			Content:         content,
			OutputTokens:    usage.OutputTokens,
			ReasoningTokens: usage.ReasoningTokens,
			LatencyMS:       latencyMS,
			Status:          "success",
		},
		attachmentRows,
	); err != nil {
		retErr = err
		return nil, err
	}
	assistantMessage.Content = content
	assistantMessage.OutputTokens = usage.OutputTokens
	assistantMessage.ReasoningTokens = usage.ReasoningTokens
	assistantMessage.TokenUsage = assistantMessage.OutputTokens + assistantMessage.ReasoningTokens
	assistantMessage.LatencyMS = latencyMS
	assistantMessage.Status = "success"
	assistantMessage.Attachments = string(marshalAttachmentSnapshots(attachmentsFromVideoFiles(uploaded)))
	run.InputTokens = usage.InputTokens
	run.OutputTokens = usage.OutputTokens
	run.CacheReadTokens = usage.CacheReadTokens
	run.CacheWriteTokens = usage.CacheWriteTokens
	run.ReasoningTokens = usage.ReasoningTokens
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

func mediaVideoUserContentType(hasReference bool) string {
	if hasReference {
		return "mixed"
	}
	return "text"
}

func mediaVideoRunningMessage(referenceKind string) string {
	switch strings.TrimSpace(referenceKind) {
	case llm.ContentPartImage:
		return "generating video from reference image"
	case llm.ContentPartVideo:
		return "extending reference video"
	default:
		return "generating video"
	}
}

func mediaVideoTargetSize(options map[string]interface{}) string {
	if value, ok := options["size"].(string); ok {
		switch strings.TrimSpace(value) {
		case "720x1280", "1280x720", "1024x1792", "1792x1024":
			return strings.TrimSpace(value)
		}
	}
	aspectRatio := strings.TrimSpace(firstNonEmpty(
		modelOptionStringValue(options["aspect_ratio"]),
		modelOptionStringValue(options["aspectRatio"]),
	))
	resolution := strings.TrimSpace(modelOptionStringValue(options["resolution"]))
	switch {
	case resolution == "1080p" && aspectRatio == "9:16":
		return "1024x1792"
	case resolution == "1080p" && aspectRatio == "16:9":
		return "1792x1024"
	case aspectRatio == "16:9":
		return "1280x720"
	case aspectRatio == "9:16":
		return "720x1280"
	}
	return "720x1280"
}

func modelOptionStringValue(value interface{}) string {
	if typed, ok := value.(string); ok {
		return strings.TrimSpace(typed)
	}
	return ""
}

func mediaVideoReferenceAttachmentKind(attachment AttachmentInput) string {
	mimeType := strings.ToLower(strings.TrimSpace(firstNonEmpty(attachment.DetectedMIME, attachment.MimeType)))
	switch {
	case strings.TrimSpace(attachment.Kind) == "image" || attachment.FileCategory == fileCategoryImage || strings.HasPrefix(mimeType, "image/"):
		return llm.ContentPartImage
	case strings.TrimSpace(attachment.Kind) == "video" || attachment.FileCategory == fileCategoryVideo || strings.HasPrefix(mimeType, "video/"):
		return llm.ContentPartVideo
	default:
		return ""
	}
}

func normalizeMediaVideoReferenceFileIDs(fileIDs []string, inputReferenceFileID string) ([]string, error) {
	normalized := make([]string, 0, 1)
	appendUnique := func(raw string) {
		id := strings.TrimSpace(raw)
		if id == "" {
			return
		}
		for _, existing := range normalized {
			if existing == id {
				return
			}
		}
		normalized = append(normalized, id)
	}

	for _, fileID := range fileIDs {
		appendUnique(fileID)
	}
	inputReferenceFileID = strings.TrimSpace(inputReferenceFileID)
	if inputReferenceFileID != "" {
		if len(normalized) > 0 && normalized[0] != inputReferenceFileID {
			return nil, ErrMediaVideoTooManyInputs
		}
		appendUnique(inputReferenceFileID)
	}
	if len(normalized) > 1 {
		return nil, ErrMediaVideoTooManyInputs
	}
	return normalized, nil
}

func (s *Service) resolveMediaVideoReferenceInput(ctx context.Context, input MediaVideoInput, targetSize string) ([]AttachmentInput, *llm.ContentPart, error) {
	if len(input.FileIDs) == 0 {
		return nil, nil, nil
	}
	if len(input.FileIDs) > 1 {
		return nil, nil, ErrMediaVideoTooManyInputs
	}
	attachments, err := s.resolveAttachments(ctx, input.UserID, input.FileIDs)
	if err != nil {
		return nil, nil, err
	}
	if len(attachments) != 1 {
		return nil, nil, ErrMediaVideoReferenceInvalid
	}
	attachment := attachments[0]
	referenceKind := mediaVideoReferenceAttachmentKind(attachment)
	if referenceKind == "" {
		return nil, nil, ErrMediaVideoReferenceInvalid
	}
	part, err := s.readMediaVideoReferenceFile(ctx, input.UserID, attachment.FileID, targetSize, referenceKind)
	if err != nil {
		return nil, nil, err
	}
	if referenceKind == llm.ContentPartVideo {
		part.FileName = mediaVideoReferenceVideoFileName(attachment.FileName)
	} else {
		part.FileName = mediaVideoReferenceInputFileName(attachment.FileName)
	}
	return attachments, &part, nil
}

func (s *Service) readMediaVideoReferenceFile(ctx context.Context, userID uint, fileID string, targetSize string, referenceKind string) (llm.ContentPart, error) {
	content, err := s.OpenFileContent(ctx, userID, strings.TrimSpace(fileID))
	if err != nil {
		return llm.ContentPart{}, err
	}
	defer content.Reader.Close() //nolint:errcheck

	limit := s.cfg.Snapshot().MaxUploadFileBytes
	if limit <= 0 {
		limit = 20 * 1024 * 1024
	}
	data, err := io.ReadAll(io.LimitReader(content.Reader, limit+1))
	if err != nil {
		return llm.ContentPart{}, err
	}
	if int64(len(data)) > limit {
		return llm.ContentPart{}, ErrFileTooLarge
	}
	mimeType := strings.TrimSpace(content.ContentType)
	if mimeType == "" {
		mimeType = strings.TrimSpace(content.File.DetectedMIME)
	}
	switch referenceKind {
	case llm.ContentPartVideo:
		data, mimeType, err = normalizeMediaVideoReferenceVideoInput(data, mimeType)
		if err != nil {
			return llm.ContentPart{}, ErrMediaVideoReferenceInvalid
		}
		return llm.ContentPart{
			Kind:     llm.ContentPartVideo,
			MimeType: mimeType,
			Data:     data,
			FileName: mediaVideoReferenceVideoFileName(content.File.FileName),
		}, nil
	default:
		data, mimeType, err = normalizeMediaVideoReferenceInput(data, mimeType, targetSize)
		if err != nil {
			return llm.ContentPart{}, ErrMediaVideoReferenceInvalid
		}
		return llm.ContentPart{
			Kind:     llm.ContentPartImage,
			MimeType: mimeType,
			Data:     data,
			FileName: mediaVideoReferenceInputFileName(content.File.FileName),
		}, nil
	}
}

func validateGeneratedVideoBytes(data []byte, declaredMIME string) ([]byte, string, error) {
	if len(data) == 0 {
		return nil, strings.TrimSpace(declaredMIME), ErrUpstreamEmptyResponse
	}
	if len(data) >= 12 && bytes.Equal(data[4:8], []byte("ftyp")) {
		return data, "video/mp4", nil
	}
	return nil, strings.TrimSpace(declaredMIME), fmt.Errorf("generated video content is not a supported mp4")
}

func generatedVideoFileName(modelName string, capturedAt time.Time, index int, total int, mimeType string) string {
	base := sanitizeGeneratedImageFileBase(modelName)
	if base == "image" {
		base = "video"
	}
	timestamp := fmt.Sprintf("%s-%03d", capturedAt.Format("20060102-150405"), capturedAt.Nanosecond()/int(time.Millisecond))
	if total > 1 {
		return fmt.Sprintf("%s-%s-%02d%s", base, timestamp, index+1, videoFileExtension(mimeType))
	}
	return fmt.Sprintf("%s-%s%s", base, timestamp, videoFileExtension(mimeType))
}

func videoFileExtension(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "video/mp4":
		return ".mp4"
	default:
		return ".mp4"
	}
}

func generatedVideoMarkdown(files []model.FileObject) string {
	blocks := make([]string, 0, len(files))
	for i, file := range files {
		label := "Generated video"
		if len(files) > 1 {
			label = fmt.Sprintf("Generated video %d", i+1)
		}
		blocks = append(blocks, fmt.Sprintf("[%s](/api/v1/files/%s/content)", label, file.FileID))
	}
	return strings.Join(blocks, "\n\n")
}

func attachmentsFromVideoFiles(files []model.FileObject) []AttachmentInput {
	items := make([]AttachmentInput, 0, len(files))
	for _, file := range files {
		items = append(items, AttachmentInput{
			FileObjID:        file.ID,
			FileID:           file.FileID,
			Kind:             "video",
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
