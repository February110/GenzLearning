using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace class_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _cfg;

        public AiController(IHttpClientFactory httpClientFactory, IConfiguration cfg)
        {
            _httpClientFactory = httpClientFactory;
            _cfg = cfg;
        }

        public record QuizRequest(string Content, int? Count = null, string? Language = "vi");
        public record QuizItem(string Question, List<string> Options, string Answer, string? Explanation);
        public record QuizResponse(List<QuizItem> Items);

        [HttpPost("generate-quiz")]
        public async Task<IActionResult> GenerateQuiz([FromBody] QuizRequest req, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(req.Content))
                return BadRequest(new { message = "Thiếu nội dung nguồn." });

            var apiKey = _cfg["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            var model = _cfg["Gemini:Model"] ?? "gemini-2.5-flash";

            if (string.IsNullOrWhiteSpace(apiKey))
                return StatusCode(500, new { message = "Chưa cấu hình Gemini:ApiKey hoặc GEMINI_API_KEY." });

            var count = Math.Clamp(req.Count ?? 5, 3, 15);
            var langCode = string.IsNullOrWhiteSpace(req.Language) ? "vi" : req.Language!;
            var langLabel = langCode.Equals("vi", StringComparison.OrdinalIgnoreCase) ? "Việt" : "Anh";

            var source = req.Content.Length > 4000 ? req.Content[..4000] : req.Content;

            var prompt = $@"Bạn là trợ lý giáo dục. Từ nội dung sau, tạo {count} câu hỏi trắc nghiệm tiếng {langLabel}.
Mỗi câu có 4 phương án, chỉ 1 đáp án đúng. Trả về JSON object đúng mẫu:

{{
  ""items"": [
    {{
      ""question"": ""string"",
      ""options"": [""A"", ""B"", ""C"", ""D""],
      ""answer"": ""exact option text"",
      ""explanation"": ""ngắn gọn lý do""
    }}
  ]
}}

Không trả thêm bất kỳ chữ nào ngoài JSON.

Nội dung nguồn (có thể đã được rút gọn nếu quá dài):
{source}";

            var body = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                }
            };

            var client = _httpClientFactory.CreateClient();
            var endpoint =
                $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

            var httpResp = await client.PostAsync(
                endpoint,
                new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
                ct
            );

            var raw = await httpResp.Content.ReadAsStringAsync(ct);

            if (!httpResp.IsSuccessStatusCode)
            {
                string? errMsg = null;
                try
                {
                    using var errDoc = JsonDocument.Parse(raw);
                    errMsg = errDoc.RootElement.GetProperty("error").GetProperty("message").GetString();
                }
                catch { }

                return StatusCode((int)httpResp.StatusCode, new
                {
                    message = errMsg ?? "Gọi Gemini API thất bại"
                });
            }

            using var doc = JsonDocument.Parse(raw);
            var text = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            if (string.IsNullOrWhiteSpace(text))
                return StatusCode(500, new { message = "Phản hồi rỗng từ Gemini." });
            text = text.Trim();
            if (text.StartsWith("```"))
            {
                var firstNewLine = text.IndexOf('\n');
                var lastFence = text.LastIndexOf("```", StringComparison.Ordinal);
                if (firstNewLine >= 0 && lastFence > firstNewLine)
                {
                    text = text.Substring(firstNewLine + 1, lastFence - firstNewLine - 1).Trim();
                }
            }
            var firstBrace = text.IndexOfAny(new[] { '{', '[' });
            if (firstBrace > 0)
                text = text.Substring(firstBrace);

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            QuizResponse data;
            try
            {
                data = JsonSerializer.Deserialize<QuizResponse>(text, options)
                       ?? new QuizResponse(new List<QuizItem>());
            }
            catch
            {
                var items = JsonSerializer.Deserialize<List<QuizItem>>(text, options)
                            ?? new List<QuizItem>();
                data = new QuizResponse(items);
            }

            return Ok(data);
        }
    }
}
