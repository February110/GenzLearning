using System.Net;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using class_api.Domain;
using class_api.Infrastructure.Data;
using class_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace class_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private const int MaxLessonContentChars = 30000;
        private const long MaxUploadBytes = 20L * 1024 * 1024;
        private static readonly Regex HtmlTagRegex = new("<[^>]+>", RegexOptions.Compiled);

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _cfg;
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUser _me;

        public AiController(
            IHttpClientFactory httpClientFactory,
            IConfiguration cfg,
            ApplicationDbContext db,
            ICurrentUser me)
        {
            _httpClientFactory = httpClientFactory;
            _cfg = cfg;
            _db = db;
            _me = me;
        }

        [HttpPost("generate-quiz")]
        public async Task<IActionResult> GenerateQuiz([FromBody] GenerateQuizRequest req, CancellationToken ct)
        {
            return await GenerateQuizInternal(req, ct);
        }

        [HttpPost("generate-quiz-from-lecture")]
        public async Task<IActionResult> GenerateQuizFromLecture([FromBody] GenerateQuizFromLectureRequest request, CancellationToken ct)
        {
            if (request.ClassroomId == Guid.Empty)
                return BadRequest(new { message = "Thiếu lớp học." });
            if (request.LessonId == Guid.Empty)
                return BadRequest(new { message = "Thiếu bài giảng." });

            var isTeacher = await _db.Enrollments.AnyAsync(e =>
                e.ClassroomId == request.ClassroomId &&
                e.UserId == _me.UserId &&
                e.Role == "Teacher", ct);
            var isAdmin = await _db.Users.AnyAsync(
                u => u.Id == _me.UserId && u.SystemRole == "Admin" && u.IsActive,
                ct);

            if (!isTeacher && !isAdmin)
                return Forbid();

            var lesson = await _db.LectureLessons
                .AsNoTracking()
                .Include(l => l.Section)
                .FirstOrDefaultAsync(l =>
                    l.Id == request.LessonId &&
                    l.Section != null &&
                    l.Section.ClassroomId == request.ClassroomId,
                    ct);

            if (lesson == null)
                return NotFound(new { message = "Không tìm thấy bài giảng trong lớp này." });

            var lessonContent = BuildLectureLessonContent(lesson);
            if (string.IsNullOrWhiteSpace(lessonContent))
                return BadRequest(new { message = "Bài giảng chưa có nội dung chữ để tạo câu hỏi." });

            var req = new GenerateQuizRequest
            {
                Title = request.Title,
                Topic = string.IsNullOrWhiteSpace(request.Topic) ? lesson.Title : request.Topic,
                LessonContent = lessonContent,
                NumberOfQuestions = request.NumberOfQuestions,
                Difficulty = request.Difficulty,
                AnswersPerQuestion = request.AnswersPerQuestion <= 0 ? 4 : request.AnswersPerQuestion
            };

            return await GenerateQuizInternal(req, ct);
        }

        [HttpPost("generate-quiz-from-file")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> GenerateQuizFromFile(
            [FromForm] string? title,
            [FromForm] string? topic,
            [FromForm] string? difficulty,
            [FromForm] int numberOfQuestions,
            [FromForm] int answersPerQuestion,
            [FromForm] IFormFile? file,
            CancellationToken ct)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Vui lòng tải lên file tài liệu." });

            if (file.Length > MaxUploadBytes)
                return BadRequest(new { message = "File tài liệu không được vượt quá 20MB." });

            string lessonContent;
            try
            {
                lessonContent = await ExtractTextFromFile(file, ct);
            }
            catch (NotSupportedException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidDataException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    message = "Không đọc được nội dung file tài liệu.",
                    detail = ex.Message
                });
            }

            if (string.IsNullOrWhiteSpace(lessonContent))
                return BadRequest(new { message = "Không trích xuất được nội dung từ file tài liệu." });

            var req = new GenerateQuizRequest
            {
                Title = title ?? string.Empty,
                Topic = topic ?? string.Empty,
                LessonContent = lessonContent,
                NumberOfQuestions = numberOfQuestions,
                Difficulty = difficulty ?? string.Empty,
                AnswersPerQuestion = answersPerQuestion <= 0 ? 4 : answersPerQuestion
            };

            return await GenerateQuizInternal(req, ct);
        }

        private async Task<IActionResult> GenerateQuizInternal(GenerateQuizRequest req, CancellationToken ct)
        {
            var requestErrors = ValidateRequest(req);
            if (requestErrors.Count > 0)
                return BadRequest(new { message = "Dữ liệu yêu cầu không hợp lệ.", errors = requestErrors });

            var canCreateAssignments = await _db.Enrollments.AnyAsync(
                e => e.UserId == _me.UserId && e.Role == "Teacher",
                ct);
            var isAdmin = await _db.Users.AnyAsync(
                u => u.Id == _me.UserId && u.SystemRole == "Admin" && u.IsActive,
                ct);

            if (!canCreateAssignments && !isAdmin)
                return Forbid();

            var apiKey = _cfg["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            var model = _cfg["Gemini:Model"] ?? Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-2.5-flash";

            if (string.IsNullOrWhiteSpace(apiKey))
                return StatusCode(500, new { message = "Chưa cấu hình Gemini:ApiKey hoặc GEMINI_API_KEY." });

            var questionCount = Math.Clamp(req.NumberOfQuestions, 1, 30);
            var answersPerQuestion = Math.Clamp(req.AnswersPerQuestion <= 0 ? 4 : req.AnswersPerQuestion, 2, 4);
            var prompt = BuildPrompt(req, questionCount, answersPerQuestion);

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
                },
                generationConfig = new
                {
                    responseMimeType = "application/json"
                }
            };

            var client = _httpClientFactory.CreateClient();
            var endpoint =
                $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

            var httpResp = await client.PostAsync(
                endpoint,
                new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
                ct);

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
                    message = errMsg ?? "Gọi Gemini API thất bại."
                });
            }

            QuizDataDto quizData;
            try
            {
                var text = ExtractGeminiText(raw);
                quizData = JsonSerializer.Deserialize<QuizDataDto>(
                    text,
                    new JsonSerializerOptions(JsonSerializerDefaults.Web)
                    {
                        PropertyNameCaseInsensitive = true
                    }) ?? new QuizDataDto();
            }
            catch (Exception ex)
            {
                return StatusCode(502, new
                {
                    message = "Không parse được JSON từ Gemini.",
                    detail = ex.Message
                });
            }

            if (string.IsNullOrWhiteSpace(quizData.Title)) quizData.Title = req.Title.Trim();
            if (string.IsNullOrWhiteSpace(quizData.Topic)) quizData.Topic = req.Topic.Trim();
            if (string.IsNullOrWhiteSpace(quizData.Difficulty)) quizData.Difficulty = req.Difficulty.Trim();

            QuizService.NormalizeQuiz(quizData);
            var errors = QuizService.ValidateQuiz(quizData, questionCount, answersPerQuestion);
            if (errors.Count > 0)
                return BadRequest(new { message = "Dữ liệu AI trả về không hợp lệ", errors });

            return Ok(new
            {
                message = "Sinh câu hỏi thành công",
                data = quizData
            });
        }

        private static List<string> ValidateRequest(GenerateQuizRequest req)
        {
            var errors = new List<string>();
            if (string.IsNullOrWhiteSpace(req.Title)) errors.Add("Thiếu tiêu đề bài tập.");
            if (string.IsNullOrWhiteSpace(req.Topic)) errors.Add("Thiếu chủ đề bài học.");
            if (string.IsNullOrWhiteSpace(req.LessonContent)) errors.Add("Thiếu nội dung bài học.");
            if (req.NumberOfQuestions <= 0) errors.Add("Số lượng câu hỏi phải lớn hơn 0.");
            if (req.AnswersPerQuestion is < 2 or > 4) errors.Add("Số đáp án mỗi câu phải từ 2 đến 4.");
            if (string.IsNullOrWhiteSpace(req.Difficulty)) errors.Add("Thiếu mức độ khó.");
            return errors;
        }

        private static string BuildPrompt(GenerateQuizRequest req, int questionCount, int answersPerQuestion)
        {
            var lessonContent = req.LessonContent.Trim();
            if (lessonContent.Length > MaxLessonContentChars)
                lessonContent = lessonContent[..MaxLessonContentChars];

            var optionLines = string.Join(Environment.NewLine, new[]
            {
                "        { \"id\": \"A\", \"content\": \"Đáp án A\" },",
                "        { \"id\": \"B\", \"content\": \"Đáp án B\" },",
                "        { \"id\": \"C\", \"content\": \"Đáp án C\" },",
                "        { \"id\": \"D\", \"content\": \"Đáp án D\" }"
            }.Take(answersPerQuestion));
            var optionIds = string.Join(", ", new[] { "A", "B", "C", "D" }.Take(answersPerQuestion));
            var sb = new StringBuilder();
            sb.AppendLine("Bạn là hệ thống hỗ trợ giáo viên tạo câu hỏi trắc nghiệm cho nền tảng học tập GenzLearning.");
            sb.AppendLine();
            sb.AppendLine($"Hãy tạo {questionCount} câu hỏi trắc nghiệm dựa trên nội dung bài học sau:");
            sb.AppendLine();
            sb.AppendLine(lessonContent);
            sb.AppendLine();
            sb.AppendLine("Thông tin yêu cầu:");
            sb.AppendLine($"- Tên bài trắc nghiệm: {req.Title.Trim()}");
            sb.AppendLine($"- Chủ đề: {req.Topic.Trim()}");
            sb.AppendLine($"- Mức độ: {req.Difficulty.Trim()}");
            sb.AppendLine($"- Mỗi câu có đúng {answersPerQuestion} đáp án {optionIds}.");
            sb.AppendLine("- Mỗi câu chỉ có đúng 1 đáp án đúng.");
            sb.AppendLine("- Câu hỏi phải bám sát nội dung bài học.");
            sb.AppendLine("- Không hỏi nội dung nằm ngoài tài liệu.");
            sb.AppendLine("- Đáp án nhiễu phải hợp lý, không quá vô lý.");
            sb.AppendLine("- Không tạo câu hỏi mơ hồ.");
            sb.AppendLine("- Không giải thích ngoài JSON.");
            sb.AppendLine("- Trả về JSON hợp lệ theo schema.");
            sb.AppendLine();
            sb.AppendLine("JSON cần có cấu trúc:");
            sb.AppendLine("{");
            sb.AppendLine("  \"title\": \"Tên bài trắc nghiệm\",");
            sb.AppendLine("  \"topic\": \"Chủ đề\",");
            sb.AppendLine("  \"difficulty\": \"Mức độ\",");
            sb.AppendLine($"  \"questionCount\": {questionCount},");
            sb.AppendLine("  \"questions\": [");
            sb.AppendLine("    {");
            sb.AppendLine("      \"id\": \"q1\",");
            sb.AppendLine("      \"question\": \"Nội dung câu hỏi\",");
            sb.AppendLine("      \"options\": [");
            sb.AppendLine(optionLines);
            sb.AppendLine("      ],");
            sb.AppendLine("      \"correctOptionId\": \"A\",");
            sb.AppendLine("      \"explanation\": \"Giải thích ngắn gọn vì sao đáp án đúng\"");
            sb.AppendLine("    }");
            sb.AppendLine("  ]");
            sb.AppendLine("}");
            return sb.ToString();
        }

        private static string BuildLectureLessonContent(LectureLesson lesson)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"Tiêu đề bài giảng: {lesson.Title}");

            var description = StripHtml(lesson.Description);
            if (!string.IsNullOrWhiteSpace(description))
            {
                sb.AppendLine();
                sb.AppendLine("Nội dung bài giảng:");
                sb.AppendLine(description);
            }

            return sb.ToString().Trim();
        }

        private static string StripHtml(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;

            var withoutTags = HtmlTagRegex.Replace(input, " ");
            var decoded = WebUtility.HtmlDecode(withoutTags);
            return string.Join(" ", decoded.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        }

        private static async Task<string> ExtractTextFromFile(IFormFile file, CancellationToken ct)
        {
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var contentType = file.ContentType ?? string.Empty;

            if (extension is ".txt" or ".md" or ".csv" or ".json" ||
                contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase))
                return await ReadTextFile(file, ct);

            return extension switch
            {
                ".pdf" => await ReadPdfFile(file, ct),
                ".docx" => await ReadDocxFile(file, ct),
                _ => throw new NotSupportedException("Chỉ hỗ trợ file TXT, PDF, DOCX hoặc file text phổ biến.")
            };
        }

        private static async Task<string> ReadTextFile(IFormFile file, CancellationToken ct)
        {
            await using var stream = file.OpenReadStream();
            using var reader = new StreamReader(
                stream,
                Encoding.UTF8,
                detectEncodingFromByteOrderMarks: true,
                leaveOpen: false);

            return await reader.ReadToEndAsync(ct);
        }

        private static async Task<string> ReadPdfFile(IFormFile file, CancellationToken ct)
        {
            await using var stream = file.OpenReadStream();
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);

            using var document = PdfDocument.Open(ms.ToArray());
            var sb = new StringBuilder();

            foreach (var page in document.GetPages())
            {
                ct.ThrowIfCancellationRequested();
                sb.AppendLine(page.Text);
                sb.AppendLine();
            }

            return sb.ToString();
        }

        private static async Task<string> ReadDocxFile(IFormFile file, CancellationToken ct)
        {
            await using var stream = file.OpenReadStream();
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            ms.Position = 0;

            using var archive = new ZipArchive(ms, ZipArchiveMode.Read, leaveOpen: false);
            var entry = archive.GetEntry("word/document.xml")
                ?? throw new InvalidDataException("File DOCX không có nội dung văn bản hợp lệ.");

            using var entryStream = entry.Open();
            var doc = XDocument.Load(entryStream);
            XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

            var paragraphs = doc
                .Descendants(w + "p")
                .Select(p => string.Concat(p.Descendants(w + "t").Select(t => t.Value)).Trim())
                .Where(text => !string.IsNullOrWhiteSpace(text))
                .ToList();

            if (paragraphs.Count > 0)
                return string.Join(Environment.NewLine, paragraphs);

            return string.Join(" ", doc.Descendants(w + "t").Select(t => t.Value));
        }

        private static string ExtractGeminiText(string raw)
        {
            using var doc = JsonDocument.Parse(raw);
            var text = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            if (string.IsNullOrWhiteSpace(text))
                throw new InvalidOperationException("Phản hồi rỗng từ Gemini.");

            text = text.Trim();
            if (text.StartsWith("```", StringComparison.Ordinal))
            {
                var firstNewLine = text.IndexOf('\n');
                var lastFence = text.LastIndexOf("```", StringComparison.Ordinal);
                if (firstNewLine >= 0 && lastFence > firstNewLine)
                    text = text.Substring(firstNewLine + 1, lastFence - firstNewLine - 1).Trim();
            }

            var firstBrace = text.IndexOf('{');
            var lastBrace = text.LastIndexOf('}');
            if (firstBrace < 0 || lastBrace <= firstBrace)
                throw new InvalidOperationException("Gemini không trả về JSON object hợp lệ.");

            return text.Substring(firstBrace, lastBrace - firstBrace + 1);
        }
    }
}
