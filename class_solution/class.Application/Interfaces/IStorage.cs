namespace class_api.Application.Interfaces
{
    public interface IStorage
    {
        Task<(string key, long sizeBytes)> UploadAsync(
            Stream stream,
            string contentType,
            string keyPrefix,
            string fileName,
            CancellationToken ct = default
        );

        string GetTemporaryUrl(string key, int expiresInMinutes = 10080);
        string PublicUrl(string key);
        Task DeleteAsync(string key, CancellationToken ct = default);

        Task<List<(string key, long sizeBytes)>> ListAsync(string prefix, CancellationToken ct = default);
        Task UploadTextAsync(string key, string text, string contentType = "application/json", CancellationToken ct = default);
        Task<string?> ReadTextAsync(string key, CancellationToken ct = default);
    }
}
