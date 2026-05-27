package conversation

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kangzyz/Doub/backend/internal/application/channel"
	appstorage "github.com/kangzyz/Doub/backend/internal/application/objectstorage"
	appupload "github.com/kangzyz/Doub/backend/internal/application/upload"
	model "github.com/kangzyz/Doub/backend/internal/domain/conversation"
	domainuser "github.com/kangzyz/Doub/backend/internal/domain/user"
	"github.com/kangzyz/Doub/backend/internal/infra/config"
	"github.com/kangzyz/Doub/backend/internal/infra/llm"
	"github.com/kangzyz/Doub/backend/internal/infra/objectstore"
	"github.com/kangzyz/Doub/backend/internal/repository"
)

func TestDetectGeneratedImageMIMERejectsNonImageBytes(t *testing.T) {
	_, _, err := validateGeneratedImageBytes([]byte("<html>not an image</html>"), "image/png")
	if err == nil {
		t.Fatal("expected non-image generated output to be rejected")
	}
}

func TestDetectGeneratedImageMIMEUsesActualImageBytes(t *testing.T) {
	data := []byte{0xff, 0xd8, 0xff, 0xe0, 0x00}
	got, mimeType, err := validateGeneratedImageBytes(data, "image/png")
	if err != nil {
		t.Fatalf("expected jpeg bytes to pass validation: %v", err)
	}
	if !bytes.Equal(got, data) {
		t.Fatal("expected validation to return original bytes")
	}
	if mimeType != "image/jpeg" {
		t.Fatalf("expected actual jpeg MIME, got %q", mimeType)
	}
}

func TestStripBase64DataURLPrefix(t *testing.T) {
	got := stripBase64DataURLPrefix("data:image/png;base64, aGVsbG8= ")
	if got != "aGVsbG8=" {
		t.Fatalf("unexpected stripped data URL: %q", got)
	}
}

func TestStreamMediaImageEditRejectsMissingFiles(t *testing.T) {
	var service Service
	_, err := service.StreamMediaImage(context.Background(), MediaImageInput{
		TaskType: MediaImageTaskEdit,
		Prompt:   "make it brighter",
	})
	if !errors.Is(err, ErrMediaImageEditInputRequired) {
		t.Fatalf("expected missing edit input error, got %v", err)
	}
}

func TestResolveMediaImageEditInputsRejectsNonImageFile(t *testing.T) {
	repo := &mediaImageTestRepo{
		files: map[string]model.FileObject{
			"file_note": {
				ID:           1,
				FileID:       "file_note",
				UserID:       7,
				FileName:     "note.txt",
				MimeType:     "text/plain",
				DetectedMIME: "text/plain",
				FileCategory: fileCategoryText,
				StoragePath:  "inputs/note.txt",
				Status:       "active",
			},
		},
	}
	service := &Service{
		cfg:           config.NewRuntime(mediaImageTestConfig()),
		repo:          repo,
		storeProvider: mediaImageMemoryStoreProvider{store: newMediaImageMemoryStore()},
	}
	_, _, err := service.resolveMediaImageEditInputs(context.Background(), MediaImageInput{UserID: 7, TaskType: MediaImageTaskEdit, FileIDs: []string{"file_note"}})
	if !errors.Is(err, ErrMediaImageEditInputInvalid) {
		t.Fatalf("expected invalid image edit input for non-image source, got %v", err)
	}
}

func TestStreamMediaImageEditPersistsGeneratedImageAndSourceAttachment(t *testing.T) {
	sourcePNG := mediaImageTestPNG()
	editedPNG := mediaImageTestPNG()
	store := newMediaImageMemoryStore()
	store.objects["inputs/source.png"] = append([]byte(nil), sourcePNG...)
	store.contentTypes["inputs/source.png"] = "image/png"

	var upstreamSawEdit bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/edits" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatalf("parse edit multipart: %v", err)
		}
		if got := r.MultipartForm.Value["prompt"]; len(got) != 1 || got[0] != "make it brighter" {
			t.Fatalf("unexpected prompt field: %#v", got)
		}
		files := r.MultipartForm.File["image[]"]
		if len(files) != 1 {
			t.Fatalf("expected one image[] part, got %d", len(files))
		}
		if got := readMediaImageMultipartFile(t, files[0]); !bytes.Equal(got, sourcePNG) {
			t.Fatalf("upstream received wrong source bytes")
		}
		upstreamSawEdit = true
		_, _ = w.Write([]byte(`{
			"id": "img_edit_test",
			"data": [{"b64_json": "` + base64.StdEncoding.EncodeToString(editedPNG) + `"}],
			"usage": {"input_tokens": 11, "output_tokens": 22}
		}`))
	}))
	defer server.Close()

	repo := &mediaImageTestRepo{
		conversation: model.Conversation{
			ID:           42,
			UserID:       7,
			Model:        "gpt-image-1",
			Provider:     "openai",
			MessageCount: 1,
		},
		files: map[string]model.FileObject{
			"file_source": {
				ID:           1,
				FileID:       "file_source",
				UserID:       7,
				FileName:     "source.png",
				MimeType:     "image/png",
				DetectedMIME: "image/png",
				FileCategory: fileCategoryImage,
				SizeBytes:    int64(len(sourcePNG)),
				StoragePath:  "inputs/source.png",
				Status:       "active",
			},
		},
		nextMessageID: 10,
		nextFileObjID: 20,
	}
	routeResolver := &mediaImageRouteResolver{
		route: &channel.ResolvedRoute{
			PlatformModelName: "gpt-image-1",
			Protocol:          llm.AdapterOpenAIImageEdits,
			BaseURL:           server.URL,
			UpstreamModel:     "gpt-image-1",
			UpstreamName:      "test-upstream",
		},
	}
	runtime := config.NewRuntime(mediaImageTestConfig())
	uploadSvc := appupload.NewServiceWithRuntime(runtime, repo, nil, appupload.Hooks{}, appupload.ErrorSet{
		InvalidFileReference: ErrInvalidFileReference,
		FileTooLarge:         ErrFileTooLarge,
		MIMEBlocked:          ErrMIMEBlocked,
		DangerousMIMEType:    ErrDangerousMIMEType,
	}, "test")
	service := NewServiceWithRuntime(runtime, repo, nil, routeResolver, nil, llm.NewClient(), nil, nil, uploadSvc, nil, nil, nil, nil, nil, nil)
	service.SetObjectStoreProvider(mediaImageMemoryStoreProvider{store: store})

	result, err := service.StreamMediaImage(context.Background(), MediaImageInput{
		UserID:            7,
		ConversationID:    42,
		TaskType:          MediaImageTaskEdit,
		Prompt:            "make it brighter",
		PlatformModelName: "gpt-image-1",
		FileIDs:           []string{"file_source"},
		ClientRunID:       "run_edit_test",
	})
	if err != nil {
		t.Fatalf("stream image edit: %v", err)
	}
	if !upstreamSawEdit {
		t.Fatal("expected upstream edit endpoint to be called")
	}
	if routeResolver.lastInput.TaskType != channel.TaskTypeImageEdit {
		t.Fatalf("expected image edit route task, got %q", routeResolver.lastInput.TaskType)
	}
	if result.UpstreamProtocol != llm.AdapterOpenAIImageEdits {
		t.Fatalf("expected edit protocol, got %q", result.UpstreamProtocol)
	}
	if !strings.Contains(result.UserMessage.Attachments, "file_source") {
		t.Fatalf("expected source attachment snapshot on user message, got %s", result.UserMessage.Attachments)
	}
	if !strings.Contains(result.AssistantMessage.Content, "/api/v1/files/") {
		t.Fatalf("expected file-backed markdown image, got %q", result.AssistantMessage.Content)
	}
	if len(repo.attachments) != 2 {
		t.Fatalf("expected source and generated attachments, got %#v", repo.attachments)
	}
	if repo.attachments[0].MessageID != result.UserMessage.ID || repo.attachments[0].FileID != "file_source" {
		t.Fatalf("expected first attachment to preserve source image, got %#v", repo.attachments[0])
	}
	if repo.attachments[1].MessageID != result.AssistantMessage.ID || repo.attachments[1].Kind != "image" {
		t.Fatalf("expected generated assistant image attachment, got %#v", repo.attachments[1])
	}
	if result.AssistantMessage.OutputTokens != 22 {
		t.Fatalf("expected parsed edit usage on assistant, got %#v", result.AssistantMessage)
	}
}

func TestStreamMediaImageEditCompletesWithSinglePartialOnIdleTimeout(t *testing.T) {
	sourcePNG := mediaImageTestPNG()
	partialPNG := mediaImageTestPNG()
	partialB64 := base64.StdEncoding.EncodeToString(partialPNG)
	store := newMediaImageMemoryStore()
	store.objects["inputs/source.png"] = append([]byte(nil), sourcePNG...)
	store.contentTypes["inputs/source.png"] = "image/png"

	var requestValues map[string][]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/edits" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatalf("parse edit multipart: %v", err)
		}
		requestValues = r.MultipartForm.Value
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("event: image_edit.partial_image\n"))
		_, _ = w.Write([]byte("data: {\"type\":\"image_edit.partial_image\",\"partial_image_index\":0,\"b64_json\":\"" + partialB64 + "\"}\n\n"))
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("expected response writer to flush")
		}
		flusher.Flush()
		time.Sleep(200 * time.Millisecond)
	}))
	defer server.Close()

	repo := &mediaImageTestRepo{
		conversation: model.Conversation{
			ID:           42,
			UserID:       7,
			Model:        "gpt-image-1",
			Provider:     "openai",
			MessageCount: 1,
		},
		files: map[string]model.FileObject{
			"file_source": {
				ID:           1,
				FileID:       "file_source",
				UserID:       7,
				FileName:     "source.png",
				MimeType:     "image/png",
				DetectedMIME: "image/png",
				FileCategory: fileCategoryImage,
				SizeBytes:    int64(len(sourcePNG)),
				StoragePath:  "inputs/source.png",
				Status:       "active",
			},
		},
		nextMessageID: 10,
		nextFileObjID: 20,
	}
	routeResolver := &mediaImageRouteResolver{
		route: &channel.ResolvedRoute{
			PlatformModelName:   "gpt-image-1",
			Protocol:            llm.AdapterOpenAIImageEdits,
			BaseURL:             server.URL,
			UpstreamModel:       "gpt-image-1",
			UpstreamName:        "test-upstream",
			StreamIdleTimeoutMS: 50,
		},
	}
	runtime := config.NewRuntime(mediaImageTestConfig())
	uploadSvc := appupload.NewServiceWithRuntime(runtime, repo, nil, appupload.Hooks{}, appupload.ErrorSet{
		InvalidFileReference: ErrInvalidFileReference,
		FileTooLarge:         ErrFileTooLarge,
		MIMEBlocked:          ErrMIMEBlocked,
		DangerousMIMEType:    ErrDangerousMIMEType,
	}, "test")
	service := NewServiceWithRuntime(runtime, repo, nil, routeResolver, nil, llm.NewClient(), nil, nil, uploadSvc, nil, nil, nil, nil, nil, nil)
	service.SetObjectStoreProvider(mediaImageMemoryStoreProvider{store: store})

	var sawDelta bool
	result, err := service.StreamMediaImage(context.Background(), MediaImageInput{
		UserID:            7,
		ConversationID:    42,
		TaskType:          MediaImageTaskEdit,
		Prompt:            "make it brighter",
		PlatformModelName: "gpt-image-1",
		FileIDs:           []string{"file_source"},
		Options:           map[string]interface{}{"partial_images": 1},
		ClientRunID:       "run_edit_partial_timeout",
		OnEvent: func(eventType string, payload map[string]interface{}) error {
			if value, ok := payload["b64_json"].(string); eventType == "media_image_delta" && ok && strings.TrimSpace(value) == partialB64 {
				sawDelta = true
			}
			return nil
		},
	})
	if err != nil {
		t.Fatalf("stream image edit should complete from partial fallback: %v", err)
	}
	if requestValues["stream"][0] != "true" || requestValues["partial_images"][0] != "1" {
		t.Fatalf("expected single partial stream request, got %#v", requestValues)
	}
	if !sawDelta {
		t.Fatal("expected partial image delta before fallback completion")
	}
	if routeResolver.failures != 0 || routeResolver.successes != 1 {
		t.Fatalf("expected fallback to mark route success only, successes=%d failures=%d", routeResolver.successes, routeResolver.failures)
	}
	if result.AssistantMessage.Status != "success" || !strings.Contains(result.AssistantMessage.Content, "/api/v1/files/") {
		t.Fatalf("expected successful file-backed assistant image, got %#v", result.AssistantMessage)
	}
	if len(repo.attachments) != 2 {
		t.Fatalf("expected source and generated attachments, got %#v", repo.attachments)
	}
	generatedAttachment := repo.attachments[1]
	if got := store.objects[generatedAttachment.StoragePath]; !bytes.Equal(got, partialPNG) {
		t.Fatalf("expected generated attachment to store partial image bytes")
	}
}

func mediaImageTestConfig() config.Config {
	return config.Config{
		MaxUploadFileBytes:       1024 * 1024,
		FileImageMaxBytes:        1024 * 1024,
		FileAllowedMIMETypes:     "image/png,image/jpeg,image/webp,image/gif,text/plain",
		UserStorageQuotaBytes:    1024 * 1024 * 1024,
		ModelOptionPolicyMode:    modelOptionPolicyAllowlist,
		ModelOptionAllowedPaths:  config.DefaultModelOptionAllowedPathsJSON(),
		ModelOptionDeniedPaths:   config.DefaultModelOptionDeniedPathsJSON(),
		ContextMaxTurns:          20,
		ConversationTaskModel:    "gpt-image-1",
		ConversationTitlePrompt:  conversationMetadataTitlePrompt,
		ConversationLabelsPrompt: conversationMetadataLabelsPrompt,
	}
}

func mediaImageTestPNG() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00, 0x00, 0x00, 0x00, 'I', 'E', 'N', 'D', 0xae, 0x42, 0x60, 0x82}
}

func readMediaImageMultipartFile(t *testing.T, fileHeader *multipart.FileHeader) []byte {
	t.Helper()
	file, err := fileHeader.Open()
	if err != nil {
		t.Fatalf("open multipart file: %v", err)
	}
	defer file.Close() //nolint:errcheck
	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("read multipart file: %v", err)
	}
	return data
}

type mediaImageRouteResolver struct {
	route     *channel.ResolvedRoute
	lastInput channel.ResolveRouteInput
	failures  int
	successes int
}

func (r *mediaImageRouteResolver) ResolveRoute(ctx context.Context, input channel.ResolveRouteInput) (*channel.ResolvedRoute, error) {
	r.lastInput = input
	return r.route, nil
}

func (r *mediaImageRouteResolver) MarkRouteFailure(ctx context.Context, route *channel.ResolvedRoute, cause error) {
	r.failures++
}

func (r *mediaImageRouteResolver) MarkRouteSuccess(ctx context.Context, route *channel.ResolvedRoute) {
	r.successes++
}

type mediaImageTestRepo struct {
	repository.ConversationRepository

	conversation  model.Conversation
	files         map[string]model.FileObject
	messages      []model.Message
	attachments   []model.Attachment
	runs          []model.Run
	nextMessageID uint
	nextFileObjID uint
}

func (r *mediaImageTestRepo) ListConversationRunsByRunIDs(ctx context.Context, userID uint, conversationID uint, runIDs []string) ([]model.Run, error) {
	return nil, nil
}

func (r *mediaImageTestRepo) GetConversationByUser(ctx context.Context, conversationID uint, userID uint) (*model.Conversation, error) {
	if r.conversation.ID != conversationID || r.conversation.UserID != userID {
		return nil, repository.ErrNotFound
	}
	item := r.conversation
	return &item, nil
}

func (r *mediaImageTestRepo) UpdateConversationModel(ctx context.Context, conversationID uint, platformModelName string, provider string) error {
	r.conversation.Model = platformModelName
	r.conversation.Provider = provider
	return nil
}

func (r *mediaImageTestRepo) ListRecentMessages(ctx context.Context, conversationID uint, limit int) ([]model.Message, int64, error) {
	return nil, 0, nil
}

func (r *mediaImageTestRepo) CreateMessage(ctx context.Context, item *model.Message) error {
	r.nextMessageID++
	item.ID = r.nextMessageID
	r.messages = append(r.messages, *item)
	return nil
}

func (r *mediaImageTestRepo) CreateMessagePairWithUserAttachments(ctx context.Context, userMessage *model.Message, assistantMessage *model.Message, userAttachments []model.Attachment) error {
	if err := r.CreateMessage(ctx, userMessage); err != nil {
		return err
	}
	for index := range userAttachments {
		userAttachments[index].ConversationID = userMessage.ConversationID
		userAttachments[index].MessageID = userMessage.ID
		userAttachments[index].UserID = userMessage.UserID
	}
	r.attachments = append(r.attachments, userAttachments...)
	parentID := userMessage.ID
	assistantMessage.ParentMessageID = &parentID
	if err := r.CreateMessage(ctx, assistantMessage); err != nil {
		return err
	}
	return r.IncrementMessageCount(ctx, userMessage.ConversationID, 2)
}

func (r *mediaImageTestRepo) CompleteAssistantMessageWithAttachments(ctx context.Context, userMessageID uint, userUsage repository.MessageUsageUpdate, assistantMessageID uint, assistantCompletion repository.AssistantMessageCompletionUpdate, assistantAttachments []model.Attachment) error {
	for index := range r.messages {
		if r.messages[index].ID == userMessageID {
			r.messages[index].InputTokens = userUsage.InputTokens
			r.messages[index].CacheReadTokens = userUsage.CacheReadTokens
			r.messages[index].CacheWriteTokens = userUsage.CacheWriteTokens
			r.messages[index].TokenUsage = userUsage.InputTokens + userUsage.CacheReadTokens + userUsage.CacheWriteTokens
		}
		if r.messages[index].ID == assistantMessageID {
			r.messages[index].Content = assistantCompletion.Content
			r.messages[index].OutputTokens = assistantCompletion.OutputTokens
			r.messages[index].ReasoningTokens = assistantCompletion.ReasoningTokens
			r.messages[index].LatencyMS = assistantCompletion.LatencyMS
			r.messages[index].Status = assistantCompletion.Status
			r.messages[index].TokenUsage = assistantCompletion.OutputTokens + assistantCompletion.ReasoningTokens
		}
	}
	for index := range assistantAttachments {
		assistantAttachments[index].MessageID = assistantMessageID
	}
	r.attachments = append(r.attachments, assistantAttachments...)
	return nil
}
func (r *mediaImageTestRepo) IncrementMessageCount(ctx context.Context, conversationID uint, delta int) error {
	r.conversation.MessageCount += delta
	return nil
}

func (r *mediaImageTestRepo) CreateAttachments(ctx context.Context, items []model.Attachment) error {
	r.attachments = append(r.attachments, items...)
	return nil
}

func (r *mediaImageTestRepo) UpdateMessageUsage(ctx context.Context, messageID uint, inputTokens int64, outputTokens int64, cacheReadTokens int64, cacheWriteTokens int64, reasoningTokens int64) error {
	for index := range r.messages {
		if r.messages[index].ID == messageID {
			r.messages[index].InputTokens = inputTokens
			r.messages[index].OutputTokens = outputTokens
			r.messages[index].CacheReadTokens = cacheReadTokens
			r.messages[index].CacheWriteTokens = cacheWriteTokens
			r.messages[index].ReasoningTokens = reasoningTokens
			return nil
		}
	}
	return nil
}

func (r *mediaImageTestRepo) UpdateMessageState(ctx context.Context, messageID uint, status string, errorCode string, errorMessage string) error {
	return nil
}

func (r *mediaImageTestRepo) UpdateAssistantMessageCompletion(ctx context.Context, messageID uint, content string, outputTokens int64, reasoningTokens int64, latencyMS int64, status string, errorCode string, errorMessage string) error {
	for index := range r.messages {
		if r.messages[index].ID == messageID {
			r.messages[index].Content = content
			r.messages[index].OutputTokens = outputTokens
			r.messages[index].ReasoningTokens = reasoningTokens
			r.messages[index].LatencyMS = latencyMS
			r.messages[index].Status = status
			return nil
		}
	}
	return nil
}

func (r *mediaImageTestRepo) UpdateMessageFollowUps(ctx context.Context, messageID uint, followUpsJSON string) error {
	for index := range r.messages {
		if r.messages[index].ID == messageID {
			r.messages[index].FollowUpsJSON = followUpsJSON
			return nil
		}
	}
	return nil
}

func (r *mediaImageTestRepo) CreateConversationRun(ctx context.Context, item *model.Run) error {
	r.runs = append(r.runs, *item)
	return nil
}

func (r *mediaImageTestRepo) GetActiveFileObjectsByIDs(ctx context.Context, userID uint, fileIDs []string) ([]model.FileObject, error) {
	items := make([]model.FileObject, 0, len(fileIDs))
	for _, fileID := range fileIDs {
		item, ok := r.files[fileID]
		if !ok || item.UserID != userID || item.Status != "active" {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *mediaImageTestRepo) GetActiveFileObjectByID(ctx context.Context, userID uint, fileID string) (*model.FileObject, error) {
	item, ok := r.files[fileID]
	if !ok || item.UserID != userID || item.Status != "active" {
		return nil, repository.ErrNotFound
	}
	copy := item
	return &copy, nil
}
func (r *mediaImageTestRepo) TouchFileObjectLastAccessedAt(ctx context.Context, userID uint, fileID string, accessedAt time.Time) error {
	return nil
}
func (r *mediaImageTestRepo) GetUserByID(ctx context.Context, userID uint) (*domainuser.User, error) {
	return &domainuser.User{ID: userID, PublicID: "user_test", Status: domainuser.StatusActive}, nil
}

func (r *mediaImageTestRepo) GetLatestActiveFileObjectBySHA(ctx context.Context, userID uint, sha256 string, sizeBytes int64) (*model.FileObject, error) {
	return nil, nil
}

func (r *mediaImageTestRepo) CreateFileObjectAndConsumeQuota(ctx context.Context, item *model.FileObject, quotaLimit int64) (*model.StorageQuota, error) {
	r.nextFileObjID++
	item.ID = r.nextFileObjID
	if r.files == nil {
		r.files = map[string]model.FileObject{}
	}
	r.files[item.FileID] = *item
	return &model.StorageQuota{UserID: item.UserID, QuotaBytes: quotaLimit, UsedBytes: item.SizeBytes}, nil
}

type mediaImageMemoryStoreProvider struct {
	store *mediaImageMemoryStore
}

var _ appstorage.Provider = mediaImageMemoryStoreProvider{}

func (p mediaImageMemoryStoreProvider) Open(ctx context.Context) (objectstore.Store, error) {
	return p.store, nil
}

type mediaImageMemoryStore struct {
	mu           sync.Mutex
	objects      map[string][]byte
	contentTypes map[string]string
}

func newMediaImageMemoryStore() *mediaImageMemoryStore {
	return &mediaImageMemoryStore{
		objects:      map[string][]byte{},
		contentTypes: map[string]string{},
	}
}

func (s *mediaImageMemoryStore) Put(ctx context.Context, key string, body io.Reader, opts objectstore.PutOptions) (objectstore.ObjectInfo, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return objectstore.ObjectInfo{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.objects[key] = append([]byte(nil), data...)
	s.contentTypes[key] = opts.ContentType
	return objectstore.ObjectInfo{Key: key, SizeBytes: int64(len(data)), ContentType: opts.ContentType, ModTime: time.Now()}, nil
}

func (s *mediaImageMemoryStore) Open(ctx context.Context, key string) (io.ReadCloser, objectstore.ObjectInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, ok := s.objects[key]
	if !ok {
		return nil, objectstore.ObjectInfo{}, objectstore.ErrNotFound
	}
	contentType := s.contentTypes[key]
	return io.NopCloser(bytes.NewReader(append([]byte(nil), data...))), objectstore.ObjectInfo{
		Key:         key,
		SizeBytes:   int64(len(data)),
		ContentType: contentType,
		ModTime:     time.Now(),
	}, nil
}

func (s *mediaImageMemoryStore) Delete(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.objects, key)
	delete(s.contentTypes, key)
	return nil
}

func (s *mediaImageMemoryStore) Materialize(ctx context.Context, key string) (string, func(), error) {
	return "", func() {}, nil
}
