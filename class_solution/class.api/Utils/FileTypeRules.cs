using System;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Http;

namespace class_api.Utils
{
    public static class FileTypeRules
    {
        private static readonly char[] Separators = { ',', ';', '\n', '\r', '\t' };

        public static string? NormalizeAllowedTypes(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var tokens = raw
                .Split(Separators, StringSplitOptions.RemoveEmptyEntries)
                .Select(t => NormalizeToken(t))
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            return tokens.Length == 0 ? null : string.Join(",", tokens);
        }

        public static string[] ParseAllowedTypes(string? normalized)
        {
            if (string.IsNullOrWhiteSpace(normalized)) return Array.Empty<string>();
            return normalized
                .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim().ToLowerInvariant())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .ToArray();
        }

        public static bool IsFileAllowed(IFormFile file, string[] allowedTokens)
        {
            if (allowedTokens.Length == 0) return true;
            var ext = Path.GetExtension(file.FileName)?.TrimStart('.').ToLowerInvariant();
            var contentType = (file.ContentType ?? string.Empty).Trim().ToLowerInvariant();
            foreach (var token in allowedTokens)
            {
                if (string.IsNullOrWhiteSpace(token)) continue;
                if (token.Contains('/'))
                {
                    if (token.EndsWith("/*", StringComparison.Ordinal))
                    {
                        var prefix = token[..^1];
                        if (contentType.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
                    }
                    else if (contentType.Equals(token, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
                else if (!string.IsNullOrEmpty(ext) && ext.Equals(token, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        public static string FormatAllowedTypes(string[] tokens)
        {
            if (tokens.Length == 0) return string.Empty;
            return string.Join(", ", tokens.Select(t => t.Contains('/') ? t : "." + t));
        }

        private static string NormalizeToken(string token)
        {
            var trimmed = token.Trim();
            if (trimmed.StartsWith(".")) trimmed = trimmed.TrimStart('.');
            return trimmed.ToLowerInvariant();
        }
    }
}
