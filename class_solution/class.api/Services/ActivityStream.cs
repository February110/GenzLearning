using class_api.Application.Dtos;
using class_api.Application.Interfaces;
using class_api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using System.Collections.Concurrent;
using System.Text.Json;

namespace class_api.Services
{
    public sealed class ActivityStream : IActivityStream
    {
        private readonly IDatabase? _redisDb;
        private readonly JsonSerializerOptions _serializerOptions;
        private readonly string _feedKey;
        private readonly int _maxEntries;
        private readonly ConcurrentQueue<ActivityEvent> _fallbackQueue = new();

        private readonly IHubContext<ActivityHub> _hub;
        public ActivityStream(
            IHubContext<ActivityHub> hub,
            IConnectionMultiplexer? redis = null,
            IOptions<JsonOptions>? jsonOptionsAccessor = null,
            IConfiguration? configuration = null)
        {
            _hub = hub;
            _redisDb = redis?.GetDatabase();
            _serializerOptions = jsonOptionsAccessor?.Value.JsonSerializerOptions ?? new JsonSerializerOptions();
            _feedKey = configuration?["Redis:ActivityFeedKey"] ?? "activity:feed";
            _maxEntries = configuration?.GetValue<int?>("Redis:ActivityFeedLimit") switch
            {
                null or <= 0 => 200,
                int value => value
            };
        }

        public async Task PublishAsync(ActivityEvent payload, CancellationToken cancellationToken = default)
        {
            if (_redisDb != null)
            {
                var serialized = JsonSerializer.Serialize(payload, _serializerOptions);
                await _redisDb.ListLeftPushAsync(_feedKey, serialized);
                await _redisDb.ListTrimAsync(_feedKey, 0, _maxEntries - 1);
            }
            else
            {
                _fallbackQueue.Enqueue(payload);
                while (_fallbackQueue.Count > _maxEntries)
                {
                    _fallbackQueue.TryDequeue(out _);
                }
            }

            await _hub.Clients.All.SendAsync("ActivityUpdated", payload, cancellationToken);
        }

        public async Task<IReadOnlyList<ActivityEvent>> GetRecentAsync(int take, CancellationToken cancellationToken = default)
        {
            var limit = Math.Clamp(take, 1, _maxEntries);
            if (_redisDb == null)
            {
                return _fallbackQueue.Reverse().Take(limit).ToList();
            }

            var entries = await _redisDb.ListRangeAsync(_feedKey, 0, limit - 1);
            var result = new List<ActivityEvent>(entries.Length);
            foreach (var value in entries)
            {
                if (!value.HasValue) continue;
                try
                {
                    var evt = JsonSerializer.Deserialize<ActivityEvent>(value!, _serializerOptions);
                    if (evt != null)
                    {
                        result.Add(evt);
                    }
                }
                catch
                {
                }
            }

            return result;
        }
    }
}
