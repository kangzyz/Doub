package conversation

import (
	"html"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var citationReferenceMarkerPattern = regexp.MustCompile(`\[(\d+)\]`)
var citationInlineLinkPattern = regexp.MustCompile(`\[(\d+)\]\(([^)\s]+)(?:\s+[^)]*)?\)`)
var citationSemanticSourceBadgePattern = regexp.MustCompile(`(?is)<span\s+class\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>\s*(来源|source)\s*</span>`)

type citationReference struct {
	index int
	url   string
}

// linkCitationMarkers 把数字引用标记 [N] 改写为真实的内联 HTML 锚点 <a href="URL">[N]</a>。
//
// 之所以使用内联 HTML 而不是 Markdown 引用式链接（[[N]][citation-N] + 末尾定义），是因为当模型在
// “视觉排版（htmlVisualPrompt）”模式下用块级 HTML（如 <div>）包裹正文时，CommonMark/remark 会把整个
// HTML 块当作原始 HTML，块内部的 Markdown 内联语法（包括引用式链接）不会被解析；而真实的 <a> 标签会被
// rehype-raw 还原成元素。前端 MarkdownLink 仅凭“外链 href + 可见文本为 [N]”识别引用胶囊，与锚点来自
// Markdown 还是原始 HTML 无关，因此内联 <a> 在纯 Markdown 正文与 HTML 片段中都能渲染成胶囊按钮。
func linkCitationMarkers(content string, citations []string) string {
	if strings.TrimSpace(content) == "" {
		return content
	}

	normalizedContent := content
	referenced := referencedCitationIndexes(content)
	if len(referenced) > 0 {
		linkURLs := citationReferenceURLs(content, citations, referenced)
		if len(linkURLs) > 0 {
			normalizedContent = rewriteInlineCitationLinks(content, linkURLs)
			normalizedContent = rewritePlainCitationMarkers(normalizedContent, linkURLs)
		}
	}

	normalizedContent = rewriteSemanticSourceBadges(normalizedContent, citations)
	return normalizedContent
}

func referencedCitationIndexes(content string) map[int]struct{} {
	matches := citationReferenceMarkerPattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return nil
	}

	result := make(map[int]struct{}, len(matches))
	for _, match := range matches {
		if len(match) < 4 {
			continue
		}
		index, ok := citationIndexFromMatch(content, match)
		if !ok {
			continue
		}
		result[index] = struct{}{}
	}
	return result
}

func citationReferenceURLs(content string, citations []string, referenced map[int]struct{}) map[int]string {
	inlineURLs := inlineCitationURLs(content)
	definitionURLs := numericReferenceDefinitionURLs(content)

	result := make(map[int]string, len(referenced))
	for index := range referenced {
		if urlValue := inlineURLs[index]; urlValue != "" {
			result[index] = urlValue
			continue
		}
		if urlValue := definitionURLs[index]; urlValue != "" {
			result[index] = urlValue
			continue
		}
		citationIndex := index - 1
		if citationIndex < 0 || citationIndex >= len(citations) {
			continue
		}
		if urlValue := normalizeCitationURL(citations[citationIndex]); urlValue != "" {
			result[index] = urlValue
		}
	}
	return result
}

func inlineCitationURLs(content string) map[int]string {
	matches := citationInlineLinkPattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return nil
	}

	result := make(map[int]string, len(matches))
	for _, match := range matches {
		if len(match) < 6 || !isCitationInlineLinkMatch(content, match) {
			continue
		}
		index, err := strconv.Atoi(content[match[2]:match[3]])
		if err != nil || index <= 0 {
			continue
		}
		if urlValue := normalizeCitationURL(content[match[4]:match[5]]); urlValue != "" {
			result[index] = urlValue
		}
	}
	return result
}

func rewriteInlineCitationLinks(content string, linkURLs map[int]string) string {
	matches := citationInlineLinkPattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return content
	}

	var builder strings.Builder
	lastWritten := 0
	changed := false
	for _, match := range matches {
		if len(match) < 6 || !isCitationInlineLinkMatch(content, match) {
			continue
		}
		index, err := strconv.Atoi(content[match[2]:match[3]])
		if err != nil || linkURLs[index] == "" {
			continue
		}
		if !changed {
			builder.Grow(len(content))
		}
		builder.WriteString(content[lastWritten:match[0]])
		builder.WriteString(citationDisplayReference(index, linkURLs[index]))
		lastWritten = match[1]
		changed = true
	}
	if !changed {
		return content
	}
	builder.WriteString(content[lastWritten:])
	return builder.String()
}

func rewritePlainCitationMarkers(content string, linkURLs map[int]string) string {
	matches := citationReferenceMarkerPattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return content
	}

	var builder strings.Builder
	lastWritten := 0
	changed := false
	for _, match := range matches {
		if len(match) < 4 || !isPlainCitationMarkerMatch(content, match) {
			continue
		}
		index, ok := citationIndexFromMatch(content, match)
		if !ok || linkURLs[index] == "" {
			continue
		}
		if !changed {
			builder.Grow(len(content))
		}
		builder.WriteString(content[lastWritten:match[0]])
		builder.WriteString(citationDisplayReference(index, linkURLs[index]))
		lastWritten = match[1]
		changed = true
	}
	if !changed {
		return content
	}
	builder.WriteString(content[lastWritten:])
	return builder.String()
}

func rewriteSemanticSourceBadges(content string, citations []string) string {
	if len(citations) == 0 || !strings.Contains(strings.ToLower(content), "<span") {
		return content
	}

	citationRefs := normalizedCitationReferences(citations)
	if len(citationRefs) == 0 {
		return content
	}

	matches := citationSemanticSourceBadgePattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return content
	}

	var builder strings.Builder
	lastWritten := 0
	citationCursor := 0
	changed := false
	for _, match := range matches {
		if len(match) < 8 {
			continue
		}
		classStart, classEnd := match[2], match[3]
		if classStart < 0 || classEnd < 0 {
			classStart, classEnd = match[4], match[5]
		}
		if classStart < 0 || classEnd < 0 || !isSemanticSourceBadgeClass(content[classStart:classEnd]) {
			continue
		}
		if citationCursor >= len(citationRefs) {
			break
		}
		if !changed {
			builder.Grow(len(content))
		}
		builder.WriteString(content[lastWritten:match[0]])
		citationRef := citationRefs[citationCursor]
		builder.WriteString(citationDisplayReference(citationRef.index, citationRef.url))
		lastWritten = match[1]
		citationCursor++
		changed = true
	}
	if !changed {
		return content
	}
	builder.WriteString(content[lastWritten:])
	return builder.String()
}

func isSemanticSourceBadgeClass(classValue string) bool {
	hasBadge := false
	hasTone := false
	for _, className := range strings.Fields(classValue) {
		switch className {
		case "badge":
			hasBadge = true
		case "badge-b", "badge-g", "badge-o", "badge-r":
			hasTone = true
		}
	}
	return hasBadge && hasTone
}

func normalizedCitationReferences(citations []string) []citationReference {
	result := make([]citationReference, 0, len(citations))
	for index, citation := range citations {
		if urlValue := normalizeCitationURL(citation); urlValue != "" {
			result = append(result, citationReference{
				index: index + 1,
				url:   urlValue,
			})
		}
	}
	return result
}

func numericReferenceDefinitionURLs(content string) map[int]string {
	var result map[int]string
	for _, line := range strings.Split(content, "\n") {
		label, urlValue, ok := parseReferenceDefinitionLine(line)
		if !ok {
			continue
		}
		index, err := strconv.Atoi(label)
		if err != nil || index <= 0 {
			continue
		}
		if urlValue := normalizeCitationURL(urlValue); urlValue != "" {
			if result == nil {
				result = make(map[int]string)
			}
			result[index] = urlValue
		}
	}
	return result
}

func citationIndexFromMatch(content string, match []int) (int, bool) {
	start := match[0]
	if start > 0 {
		switch content[start-1] {
		case '\\', '!', '[':
			return 0, false
		}
	}
	index, err := strconv.Atoi(content[match[2]:match[3]])
	if err != nil || index <= 0 {
		return 0, false
	}
	return index, true
}

func isCitationInlineLinkMatch(content string, match []int) bool {
	start := match[0]
	if start > 0 {
		switch content[start-1] {
		case '\\', '!', '[':
			return false
		}
	}
	return true
}

func isPlainCitationMarkerMatch(content string, match []int) bool {
	start := match[0]
	end := match[1]
	// 跳过已经被改写成引用锚点 ">[N]</a>" 的标记（无论是本函数前一阶段的产物，还是模型自己写出的
	// 引用锚点），否则第二轮改写会把锚点再嵌套一层 <a><a>[N]</a></a>，破坏胶囊渲染。
	if start > 0 && content[start-1] == '>' && strings.HasPrefix(content[end:], "</a>") {
		return false
	}
	if end < len(content) {
		switch content[end] {
		case ':', '(', ']':
			return false
		}
	}
	if start > 0 && content[start-1] == ']' && !previousAdjacentNumericMarker(content, start) {
		return false
	}
	return true
}

func previousAdjacentNumericMarker(content string, markerStart int) bool {
	if markerStart <= 0 || content[markerStart-1] != ']' {
		return false
	}
	openIndex := strings.LastIndex(content[:markerStart], "[")
	if openIndex < 0 {
		return false
	}
	if openIndex > 0 {
		switch content[openIndex-1] {
		case '\\', '!', '[':
			return false
		}
	}
	_, err := strconv.Atoi(content[openIndex+1 : markerStart-1])
	return err == nil
}

// citationDisplayReference 生成引用胶囊所需的内联 HTML 锚点。href 经过 HTML 转义，避免引号/尖括号/&
// 等字符破坏属性或被渲染端误解析（normalizeCitationURL 只校验 scheme/host，不会清洗这些字符）。
func citationDisplayReference(index int, citationURL string) string {
	return "<a href=\"" + html.EscapeString(citationURL) + "\">[" + strconv.Itoa(index) + "]</a>"
}

func parseReferenceDefinitionLine(line string) (string, string, bool) {
	trimmed := strings.TrimLeft(line, " ")
	if len(line)-len(trimmed) > 3 || !strings.HasPrefix(trimmed, "[") {
		return "", "", false
	}
	closeIndex := strings.Index(trimmed, "]:")
	if closeIndex <= 1 {
		return "", "", false
	}
	label := strings.TrimSpace(trimmed[1:closeIndex])
	remainder := strings.TrimSpace(trimmed[closeIndex+2:])
	if label == "" || remainder == "" {
		return "", "", false
	}
	if strings.HasPrefix(remainder, "<") {
		closeURLIndex := strings.Index(remainder, ">")
		if closeURLIndex > 1 {
			return label, remainder[1:closeURLIndex], true
		}
	}
	return label, strings.Fields(remainder)[0], true
}

func normalizeCitationURL(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" || strings.ContainsAny(value, " \t\r\n") {
		return ""
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed == nil || parsed.Host == "" {
		return ""
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		return value
	default:
		return ""
	}
}
