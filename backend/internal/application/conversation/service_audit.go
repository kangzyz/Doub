package conversation

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
)

// AuditInput 描述会话域一次审计写入。
type AuditInput struct {
	UserID     uint
	RequestID  string
	Action     string
	Resource   string
	ResourceID string
	ClientIP   string
	UserAgent  string
	Detail     interface{}
}

// SendMessageAuditInput 描述一次消息发送对应的审计上下文。
type SendMessageAuditInput struct {
	UserID         uint
	RequestID      string
	ClientIP       string
	UserAgent      string
	Action         string
	ContentType    string
	ConversationID uint
	FileIDs        []string
	Result         *SendMessageResult
}

type attachmentKindEntry struct {
	Kind     string `json:"kind"`
	MimeType string `json:"mime_type"`
}

// RecordAudit 记录会话域审计日志。
func (s *Service) RecordAudit(ctx context.Context, input AuditInput) {
	if s.auditWriter == nil {
		return
	}
	s.auditWriter.Write(
		ctx,
		strings.TrimSpace(input.RequestID),
		input.UserID,
		strings.TrimSpace(input.Action),
		strings.TrimSpace(input.Resource),
		strings.TrimSpace(input.ResourceID),
		strings.TrimSpace(input.ClientIP),
		strings.TrimSpace(input.UserAgent),
		input.Detail,
	)
}

// RecordSendMessageAudit 记录发送消息审计日志。
func (s *Service) RecordSendMessageAudit(ctx context.Context, input SendMessageAuditInput) {
	if s.auditWriter == nil || input.Result == nil {
		return
	}
	imageCount, fileCount := countAttachmentKinds(input.Result.UserMessage.Attachments)
	s.auditWriter.Write(
		ctx,
		strings.TrimSpace(input.RequestID),
		input.UserID,
		strings.TrimSpace(input.Action),
		"conversation",
		strconv.FormatUint(uint64(input.ConversationID), 10),
		strings.TrimSpace(input.ClientIP),
		strings.TrimSpace(input.UserAgent),
		map[string]interface{}{
			"content_type": strings.TrimSpace(input.ContentType),
			"attachments":  imageCount + fileCount,
			"file_ids":     len(input.FileIDs),
		},
	)
}

func countAttachmentKinds(attachmentsJSON string) (int64, int64) {
	items := make([]attachmentKindEntry, 0)
	if err := json.Unmarshal([]byte(strings.TrimSpace(attachmentsJSON)), &items); err != nil {
		return 0, 0
	}

	var imageCount int64
	var fileCount int64
	for _, item := range items {
		switch NormalizeAttachmentKind(item.Kind, item.MimeType) {
		case "image":
			imageCount++
		default:
			fileCount++
		}
	}
	return imageCount, fileCount
}
