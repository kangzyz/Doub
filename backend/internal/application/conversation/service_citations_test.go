package conversation

import "testing"

func TestLinkCitationMarkersLinksNumericMarkers(t *testing.T) {
	content := `多名开发者发现了尚未官宣的模型。[1][2]`

	got := linkCitationMarkers(content, []string{
		"https://example.com/a",
		"https://example.com/b",
	})
	want := `多名开发者发现了尚未官宣的模型。<a href="https://example.com/a">[1]</a><a href="https://example.com/b">[2]</a>`
	if got != want {
		t.Fatalf("unexpected citation markup:\nwant: %q\n got: %q", want, got)
	}
}

func TestLinkCitationMarkersLeavesEscapedMarkersUnchanged(t *testing.T) {
	content := "模型信息来源。[[1]][citation-1]\n\n[citation-1]: https://example.com/existing"

	got := linkCitationMarkers(content, []string{"https://example.com/new"})
	if got != content {
		t.Fatalf("expected bracket-escaped marker with non-numeric label to stay unchanged, got %q", got)
	}
}

func TestLinkCitationMarkersUsesModelDefinitionURLs(t *testing.T) {
	content := "模型信息来源。[1][2]\n\n[1]: https://example.com/a\n[2]: https://example.com/b"

	got := linkCitationMarkers(content, []string{
		"https://example.com/ignored-a",
		"https://example.com/ignored-b",
	})
	want := "模型信息来源。<a href=\"https://example.com/a\">[1]</a><a href=\"https://example.com/b\">[2]</a>\n\n[1]: https://example.com/a\n[2]: https://example.com/b"
	if got != want {
		t.Fatalf("expected URLs harvested from model reference definitions:\nwant: %q\n got: %q", want, got)
	}
}

func TestLinkCitationMarkersRewritesInlineNumericLinks(t *testing.T) {
	content := "BTS强势回归。[1](https://www.theamas.com/2026/05/bts-to-make-first-award-show-appearance-in-four-years/)"

	got := linkCitationMarkers(content, nil)
	want := `BTS强势回归。<a href="https://www.theamas.com/2026/05/bts-to-make-first-award-show-appearance-in-four-years/">[1]</a>`
	if got != want {
		t.Fatalf("expected inline numeric link to become a single anchor:\nwant: %q\n got: %q", want, got)
	}
}

func TestLinkCitationMarkersIgnoresUnreferencedAndInvalidURLs(t *testing.T) {
	content := "可参考 [1] 和 [3]。"

	got := linkCitationMarkers(content, []string{
		" https://example.com/a ",
		"https://example.com/unreferenced",
		"not-a-url",
	})
	want := `可参考 <a href="https://example.com/a">[1]</a> 和 [3]。`
	if got != want {
		t.Fatalf("unexpected filtered citation markup:\nwant: %q\n got: %q", want, got)
	}
}

func TestLinkCitationMarkersLeavesUnmarkedContentUnchanged(t *testing.T) {
	content := "没有引用标记的回答。"

	got := linkCitationMarkers(content, []string{"https://example.com/a"})
	if got != content {
		t.Fatalf("expected content without markers to stay unchanged, got %q", got)
	}
}

// 已经改写过的内容再次进入改写不能把锚点嵌套起来，否则会破坏前端引用胶囊渲染。
func TestLinkCitationMarkersIsIdempotent(t *testing.T) {
	content := "参考 [1] 与内联 [2](https://example.com/b)。"
	citations := []string{"https://example.com/a"}

	once := linkCitationMarkers(content, citations)
	twice := linkCitationMarkers(once, citations)
	if once != twice {
		t.Fatalf("expected rewrite to be idempotent:\nonce:  %q\ntwice: %q", once, twice)
	}
	if want := `参考 <a href="https://example.com/a">[1]</a> 与内联 <a href="https://example.com/b">[2]</a>。`; once != want {
		t.Fatalf("unexpected rewrite output:\nwant: %q\n got: %q", want, once)
	}
}

// href 必须经过 HTML 转义，含查询串的 URL 不能因 & 等字符破坏属性。
func TestLinkCitationMarkersEscapesHref(t *testing.T) {
	content := "参考 [1]。"

	got := linkCitationMarkers(content, []string{"https://example.com/?a=1&b=2"})
	want := `参考 <a href="https://example.com/?a=1&amp;b=2">[1]</a>。`
	if got != want {
		t.Fatalf("expected href to be HTML-escaped:\nwant: %q\n got: %q", want, got)
	}
}
