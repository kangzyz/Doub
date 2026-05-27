package conversation

import "testing"

func TestAppendCitationReferenceDefinitionsLinksNumericMarkers(t *testing.T) {
	content := `多名开发者发现了尚未官宣的模型。[1][2]`

	got := appendCitationReferenceDefinitions(content, []string{
		"https://example.com/a",
		"https://example.com/b",
	})
	want := "多名开发者发现了尚未官宣的模型。[[1]][citation-1][[2]][citation-2]\n\n[citation-1]: https://example.com/a\n[citation-2]: https://example.com/b"
	if got != want {
		t.Fatalf("unexpected citation reference definitions:\nwant: %q\n got: %q", want, got)
	}
}

func TestAppendCitationReferenceDefinitionsDoesNotDuplicateExistingDefinitions(t *testing.T) {
	content := "模型信息来源。[[1]][citation-1]\n\n[citation-1]: https://example.com/existing"

	got := appendCitationReferenceDefinitions(content, []string{"https://example.com/new"})
	if got != content {
		t.Fatalf("expected existing reference definition to stay unchanged, got %q", got)
	}
}

func TestAppendCitationReferenceDefinitionsSeparatesAdjacentExistingDefinitions(t *testing.T) {
	content := "模型信息来源。[1][2]\n\n[1]: https://example.com/a\n[2]: https://example.com/b"

	got := appendCitationReferenceDefinitions(content, []string{
		"https://example.com/ignored-a",
		"https://example.com/ignored-b",
	})
	want := "模型信息来源。[[1]][citation-1][[2]][citation-2]\n\n[1]: https://example.com/a\n[2]: https://example.com/b\n\n[citation-1]: https://example.com/a\n[citation-2]: https://example.com/b"
	if got != want {
		t.Fatalf("expected adjacent existing references to be separated:\nwant: %q\n got: %q", want, got)
	}
}

func TestAppendCitationReferenceDefinitionsRewritesInlineNumericLinks(t *testing.T) {
	content := "BTS强势回归。[1](https://www.theamas.com/2026/05/bts-to-make-first-award-show-appearance-in-four-years/)"

	got := appendCitationReferenceDefinitions(content, nil)
	want := "BTS强势回归。[[1]][citation-1]\n\n[citation-1]: https://www.theamas.com/2026/05/bts-to-make-first-award-show-appearance-in-four-years/"
	if got != want {
		t.Fatalf("expected inline numeric link URL to move into reference definition:\nwant: %q\n got: %q", want, got)
	}
}

func TestAppendCitationReferenceDefinitionsIgnoresUnreferencedAndInvalidURLs(t *testing.T) {
	content := "可参考 [1] 和 [3]。"

	got := appendCitationReferenceDefinitions(content, []string{
		" https://example.com/a ",
		"https://example.com/unreferenced",
		"not-a-url",
	})
	want := "可参考 [[1]][citation-1] 和 [3]。\n\n[citation-1]: https://example.com/a"
	if got != want {
		t.Fatalf("unexpected filtered citation definitions:\nwant: %q\n got: %q", want, got)
	}
}

func TestAppendCitationReferenceDefinitionsLeavesUnmarkedContentUnchanged(t *testing.T) {
	content := "没有引用标记的回答。"

	got := appendCitationReferenceDefinitions(content, []string{"https://example.com/a"})
	if got != content {
		t.Fatalf("expected content without markers to stay unchanged, got %q", got)
	}
}
