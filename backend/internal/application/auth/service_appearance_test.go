package auth

import (
	"errors"
	"testing"
)

func TestValidateAppearancePreferencesAcceptsThemePresets(t *testing.T) {
	for _, preset := range []string{
		"default",
		"azure",
		"cobalt",
		"graphite",
		"lagoon",
		"ink",
		"ochre",
		"sepia",
		"claude",
		"yan-yu",
	} {
		raw := `{"theme":"system","preset":"` + preset + `","chatFont":"default","chatFontWeight":"regular"}`
		if err := validateAppearancePreferences(raw); err != nil {
			t.Fatalf("expected preset %q to be valid, got %v", preset, err)
		}
	}
}

func TestValidateAppearancePreferencesRejectsUnknownPreset(t *testing.T) {
	err := validateAppearancePreferences(`{"preset":"unknown"}`)
	if !errors.Is(err, ErrInvalidAppearancePreferences) {
		t.Fatalf("expected ErrInvalidAppearancePreferences, got %v", err)
	}
}
