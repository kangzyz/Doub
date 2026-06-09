package conversation

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/kangzyz/Doub/backend/internal/pkg/traceid"
	"go.uber.org/zap"
)

var htmlVisualRawLogMu sync.Mutex

type htmlVisualRawResponseLogEntry struct {
	Time                string `json:"time"`
	TraceID             string `json:"traceID"`
	RequestID           string `json:"requestID"`
	ConversationID      uint   `json:"conversationID"`
	UserID              uint   `json:"userID"`
	UserMessageID       uint   `json:"userMessageID"`
	AssistantMessageID  uint   `json:"assistantMessageID"`
	RunID               string `json:"runID"`
	PlatformModelName   string `json:"platformModelName"`
	UpstreamName        string `json:"upstreamName"`
	UpstreamProtocol    string `json:"upstreamProtocol"`
	UpstreamModel       string `json:"upstreamModel"`
	ResponseID          string `json:"responseID"`
	CitationCount       int    `json:"citationCount"`
	StreamedText        string `json:"streamedText"`
	UpstreamText        string `json:"upstreamText"`
	AssistantText       string `json:"assistantText"`
	StreamedTextLength  int    `json:"streamedTextLength"`
	UpstreamTextLength  int    `json:"upstreamTextLength"`
	AssistantTextLength int    `json:"assistantTextLength"`
}

func (s *Service) logHTMLVisualRawResponse(ctx context.Context, entry htmlVisualRawResponseLogEntry) {
	logPath := filepath.Clean(os.Getenv("DOUB_HTML_VISUAL_RAW_LOG"))
	if logPath == "." || logPath == "" {
		return
	}
	entry.Time = time.Now().Format(time.RFC3339Nano)
	entry.TraceID = traceid.FromContext(ctx)
	entry.StreamedTextLength = len(entry.StreamedText)
	entry.UpstreamTextLength = len(entry.UpstreamText)
	entry.AssistantTextLength = len(entry.AssistantText)

	if err := appendHTMLVisualRawResponseLog(logPath, entry); err != nil && s.logger != nil {
		s.logger.Warn("html_visual_raw_response_log_failed",
			zap.String("path", logPath),
			zap.Uint("conversation_id", entry.ConversationID),
			zap.String("run_id", entry.RunID),
			zap.Error(err),
		)
	}
}

func appendHTMLVisualRawResponseLog(logPath string, entry htmlVisualRawResponseLogEntry) error {
	htmlVisualRawLogMu.Lock()
	defer htmlVisualRawLogMu.Unlock()

	if err := os.MkdirAll(filepath.Dir(logPath), 0o755); err != nil {
		return err
	}
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetEscapeHTML(false)
	return encoder.Encode(entry)
}
