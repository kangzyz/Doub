package conversation

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync/atomic"

	"github.com/gin-gonic/gin"
	appconversation "github.com/kangzyz/Doub/backend/internal/application/conversation"
	"github.com/kangzyz/Doub/backend/internal/shared/response"
	"github.com/kangzyz/Doub/backend/internal/transport/http/middleware"
)

// StreamImageGeneration 处理会话内图片生成流式状态接口。
func (h *Handler) StreamImageGeneration(c *gin.Context) {
	h.streamMediaImage(c, appconversation.MediaImageTaskGeneration)
}

// StreamImageEdit 处理会话内图片编辑流式状态接口。
func (h *Handler) StreamImageEdit(c *gin.Context) {
	h.streamMediaImage(c, appconversation.MediaImageTaskEdit)
}

// streamMediaImage 只负责 HTTP 绑定和 NDJSON 事件转发，图片业务由 application 执行。
func (h *Handler) streamMediaImage(c *gin.Context, taskType appconversation.MediaImageTaskType) {
	userID := middleware.MustUserID(c)
	publicID, err := stringParam(c, "id")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid conversation id")
		return
	}
	conversation, err := h.service.GetConversationByPublicID(c.Request.Context(), userID, publicID)
	if err != nil {
		if errors.Is(err, appconversation.ErrConversationNotFound) {
			response.Error(c, http.StatusNotFound, "conversation not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, "load conversation failed")
		return
	}
	var req MediaImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	req.ClientRunID = appconversation.EnsureMessageGenerationRunID(req.ClientRunID)
	req.Options = sanitizeMessageOptions(req.Options)

	c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
	c.Header("Cache-Control", "no-cache, no-transform")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	var clientDisconnected atomic.Bool
	flushStreamEvent := func(payload map[string]interface{}) error {
		payload = h.service.PublishMessageGenerationEvent(req.ClientRunID, payload)
		if clientDisconnected.Load() {
			return nil
		}
		encoded, marshalErr := json.Marshal(payload)
		if marshalErr != nil {
			return marshalErr
		}
		if _, writeErr := c.Writer.Write(append(encoded, '\n')); writeErr != nil {
			clientDisconnected.Store(true)
			return writeErr
		}
		c.Writer.Flush()
		return nil
	}

	result, err := h.service.StreamMediaImage(c.Request.Context(), appconversation.MediaImageInput{
		UserID:                userID,
		ConversationID:        conversation.ID,
		RequestID:             middleware.MustRequestID(c),
		TaskType:              taskType,
		Prompt:                req.Prompt,
		PlatformModelName:     req.Model,
		Options:               req.Options,
		ClientRunID:           req.ClientRunID,
		FileIDs:               req.FileIDs,
		MaskFileID:            req.MaskFileID,
		ParentMessagePublicID: req.ParentMessagePublicID,
		SourceMessagePublicID: req.SourceMessagePublicID,
		BranchReason:          req.BranchReason,
		OnEvent: func(eventType string, payload map[string]interface{}) error {
			_ = flushStreamEvent(normalizeStreamEventPayload(eventType, payload))
			return nil
		},
	})
	if err != nil {
		_ = flushStreamEvent(streamErrorPayload(err))
		h.service.FinishMessageGeneration(req.ClientRunID)
		return
	}

	_ = flushStreamEvent(map[string]interface{}{
		"type": "completed",
		"data": toSendMessageResponse(result),
	})
	h.service.FinishMessageGeneration(req.ClientRunID)
}
