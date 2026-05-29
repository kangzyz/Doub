package userview

import (
	"time"

	domainuser "github.com/kangzyz/Doub/backend/internal/domain/user"
)

// UserView 面向应用层传递的用户视图
// 序列化由 transport 层的响应 DTO 负责。
type UserView struct {
	ID                      uint
	PublicID                string
	Username                string
	DisplayName             string
	AvatarURL               string
	Email                   string
	Phone                   string
	Role                    string
	Status                  string
	Timezone                string
	Locale                  string
	ProfilePreferences      string
	AppearancePreferences   string
	OnboardingCompletedAt   *time.Time
	EmailVerifiedAt         *time.Time
	EmailSource             string
	EmailBootstrapUsedAt    *time.Time
	PhoneVerifiedAt         *time.Time
	UsernameChangedAt       *time.Time
	PasswordEnabled         bool
	PasswordSetAt           *time.Time
	PasswordOrigin          string
	MustResetPassword       bool
	InitialUsernameRequired bool
	InitialSecurityRequired bool
	TwoFactorAvailable      bool
	TwoFactorEnabled        bool
	TwoFactorRequired       bool
	TwoFactorRecoveryCount  int
	LastLoginAt             *time.Time
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

// FromUser 将用户领域模型转换为前端可用的用户视图。
func FromUser(item domainuser.User) UserView {
	return UserView{
		ID:                    item.ID,
		PublicID:              item.PublicID,
		Username:              item.Username,
		DisplayName:           item.DisplayName,
		AvatarURL:             item.AvatarURL,
		Email:                 item.Email,
		Phone:                 item.Phone,
		Role:                  item.Role,
		Status:                item.Status,
		Timezone:              item.Timezone,
		Locale:                item.Locale,
		ProfilePreferences:    item.ProfilePreferences,
		AppearancePreferences: item.AppearancePreferences,
		OnboardingCompletedAt: item.OnboardingCompletedAt,
		EmailVerifiedAt:       item.EmailVerifiedAt,
		EmailSource:           item.EmailSource,
		EmailBootstrapUsedAt:  item.EmailBootstrapUsedAt,
		PhoneVerifiedAt:       item.PhoneVerifiedAt,
		UsernameChangedAt:     item.UsernameChangedAt,
		LastLoginAt:           item.LastLoginAt,
		CreatedAt:             item.CreatedAt,
		UpdatedAt:             item.UpdatedAt,
	}
}
