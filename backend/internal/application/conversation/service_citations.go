package conversation

import (
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var citationReferenceMarkerPattern = regexp.MustCompile(`\[(\d+)\]`)
var citationInlineLinkPattern = regexp.MustCompile(`\[(\d+)\]\(([^)\s]+)(?:\s+[^)]*)?\)`)

const citationReferenceLabelPrefix = "citation-"

func appendCitationReferenceDefinitions(content string, citations []string) string {
	if strings.TrimSpace(content) == "" {
		return content
	}

	referenced := referencedCitationIndexes(content)
	if len(referenced) == 0 {
		return content
	}

	linkURLs := citationReferenceURLs(content, citations, referenced)
	if len(linkURLs) == 0 {
		return content
	}

	normalizedContent := rewriteInlineCitationLinks(content, linkURLs)
	normalizedContent = rewritePlainCitationMarkers(normalizedContent, linkURLs)
	definitions := make([]string, 0, len(linkURLs))
	for _, index := range sortedCitationURLIndexes(linkURLs) {
		citationURL := linkURLs[index]
		label := citationReferenceLabel(index)
		if hasMarkdownReferenceDefinition(normalizedContent, label) {
			continue
		}
		definitions = append(definitions, "["+label+"]: "+citationURL)
	}
	if len(definitions) == 0 {
		return normalizedContent
	}

	separator := "\n\n"
	if strings.HasSuffix(normalizedContent, "\n\n") {
		separator = ""
	} else if strings.HasSuffix(normalizedContent, "\n") {
		separator = "\n"
	}
	return normalizedContent + separator + strings.Join(definitions, "\n")
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
		builder.WriteString(citationDisplayReference(index))
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
		builder.WriteString(citationDisplayReference(index))
		lastWritten = match[1]
		changed = true
	}
	if !changed {
		return content
	}
	builder.WriteString(content[lastWritten:])
	return builder.String()
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

func citationDisplayReference(index int) string {
	marker := strconv.Itoa(index)
	return "[[" + marker + "]][" + citationReferenceLabel(index) + "]"
}

func citationReferenceLabel(index int) string {
	return citationReferenceLabelPrefix + strconv.Itoa(index)
}

func sortedCitationURLIndexes(linkURLs map[int]string) []int {
	indexes := make([]int, 0, len(linkURLs))
	for index := range linkURLs {
		indexes = append(indexes, index)
	}
	sort.Ints(indexes)
	return indexes
}

func hasMarkdownReferenceDefinition(content string, label string) bool {
	for _, line := range strings.Split(content, "\n") {
		existingLabel, _, ok := parseReferenceDefinitionLine(line)
		if ok && existingLabel == label {
			return true
		}
	}
	return false
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
