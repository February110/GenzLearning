using System.Text.Json;
using System.Text.Json.Serialization;

namespace class_api.Json
{
    public sealed class DateTimeUtcConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s)) return DateTime.SpecifyKind(default, DateTimeKind.Utc);
            if (DateTime.TryParse(s, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
            {
                if (dt.Kind == DateTimeKind.Unspecified) return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
                return dt.ToUniversalTime();
            }
            return DateTime.SpecifyKind(default, DateTimeKind.Utc);
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        {
            DateTime utc = value.Kind switch
            {
                DateTimeKind.Utc => value,
                DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
                _ => value.ToUniversalTime()
            };
            writer.WriteStringValue(utc.ToString("O"));
        }
    }

    public sealed class NullableDateTimeUtcConverter : JsonConverter<DateTime?>
    {
        public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null) return null;
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s)) return null;
            if (DateTime.TryParse(s, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
            {
                if (dt.Kind == DateTimeKind.Unspecified) return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
                return dt.ToUniversalTime();
            }
            return null;
        }

        public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
        {
            if (!value.HasValue)
            {
                writer.WriteNullValue();
                return;
            }

            var v = value.Value;
            DateTime utc = v.Kind switch
            {
                DateTimeKind.Utc => v,
                DateTimeKind.Unspecified => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                _ => v.ToUniversalTime()
            };

            writer.WriteStringValue(utc.ToString("O"));
        }
    }
}
